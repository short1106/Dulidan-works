import type { Database } from './sqlite'
import { transaction } from './sqlite'
import type { Address, AttachmentInfo, FolderInfo, MessageDetail, MessageSummary, ParsedMail, SpecialUse } from './types'

/**
 * Local copy of folders and mails, so the mailbox opens fast, works offline
 * and can be searched without asking the server. Only the newest mails of
 * each folder are kept; attachments are fetched from the server when needed.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS folders (
  account_id TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  special_use TEXT,
  uid_validity TEXT,
  last_uid INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, path)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  folder TEXT NOT NULL,
  uid INTEGER NOT NULL,
  message_id TEXT,
  in_reply_to TEXT,
  refs TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL DEFAULT '',
  from_json TEXT,
  to_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]',
  reply_to_json TEXT NOT NULL DEFAULT '[]',
  date INTEGER NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  snippet TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  html TEXT,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  size INTEGER NOT NULL DEFAULT 0,
  UNIQUE (account_id, folder, uid)
);
CREATE INDEX IF NOT EXISTS messages_list ON messages (account_id, folder, date DESC);
CREATE INDEX IF NOT EXISTS messages_message_id ON messages (message_id);
CREATE VIRTUAL TABLE IF NOT EXISTS messages_search USING fts5(
  subject, sender, body, tokenize = 'unicode61 remove_diacritics 2'
);
`

interface MessageRow {
  id: number
  account_id: string
  folder: string
  uid: number
  message_id: string | null
  in_reply_to: string | null
  refs: string
  subject: string
  from_json: string | null
  to_json: string
  cc_json: string
  reply_to_json: string
  date: number
  seen: number
  has_attachments: number
  snippet: string
  text: string
  html: string | null
  attachments_json: string
}

const SUMMARY_COLUMNS =
  'id, account_id, folder, uid, message_id, in_reply_to, refs, subject, from_json, to_json, cc_json, reply_to_json, date, seen, has_attachments, snippet'

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function toSummary(row: MessageRow): MessageSummary {
  return {
    id: row.id,
    accountId: row.account_id,
    folder: row.folder,
    uid: row.uid,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    references: parseJson<string[]>(row.refs, []),
    subject: row.subject,
    from: parseJson<Address | null>(row.from_json, null),
    to: parseJson<Address[]>(row.to_json, []),
    cc: parseJson<Address[]>(row.cc_json, []),
    date: row.date,
    seen: row.seen === 1,
    hasAttachments: row.has_attachments === 1,
    snippet: row.snippet
  }
}

/** First characters of the text, on one line, for the message list. */
export function makeSnippet(text: string, length = 160): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, length)
}

/**
 * Turns what the user typed into a safe full-text query: every word must
 * appear, word beginnings match ("rech" finds "Rechnung").
 */
export function buildSearchQuery(input: string): string | null {
  const words = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}@._-]+/u)
    .map((word) => word.replace(/["*]/g, ''))
    .filter((word) => word.length > 0)
    .slice(0, 8)
  if (words.length === 0) return null
  return words.map((word) => `"${word}"*`).join(' ')
}

export interface FolderUpdate {
  path: string
  name: string
  specialUse: SpecialUse
}

export interface FolderSyncState {
  uidValidity: string | null
  lastUid: number
}

export class MailCache {
  constructor(private readonly db: Database) {
    db.exec(SCHEMA)
  }

  // ---------- Folders ----------

  /** Replaces the folder list of an account, keeping the sync state of known folders. */
  setFolders(accountId: string, folders: FolderUpdate[]): void {
    transaction(this.db, () => {
      const keep = new Set(folders.map((folder) => folder.path))
      for (const row of this.db.prepare('SELECT path FROM folders WHERE account_id = ?').all(accountId) as Array<{ path: string }>) {
        if (!keep.has(row.path)) this.removeFolder(accountId, row.path)
      }
      const upsert = this.db.prepare(
        `INSERT INTO folders (account_id, path, name, special_use) VALUES (?, ?, ?, ?)
         ON CONFLICT (account_id, path) DO UPDATE SET name = excluded.name, special_use = excluded.special_use`
      )
      for (const folder of folders) upsert.run(accountId, folder.path, folder.name, folder.specialUse)
    })
  }

  folders(accountId: string): FolderInfo[] {
    const rows = this.db
      .prepare(
        `SELECT f.account_id, f.path, f.name, f.special_use,
                COUNT(m.id) AS total, COALESCE(SUM(CASE WHEN m.seen = 0 THEN 1 ELSE 0 END), 0) AS unread
         FROM folders f LEFT JOIN messages m ON m.account_id = f.account_id AND m.folder = f.path
         WHERE f.account_id = ? GROUP BY f.path ORDER BY f.path`
      )
      .all(accountId) as Array<{ account_id: string; path: string; name: string; special_use: SpecialUse; total: number; unread: number }>
    // Inbox, drafts, sent, archive, then own folders, junk and trash last.
    const order: Record<string, number> = { inbox: 0, drafts: 1, sent: 2, archive: 3, '': 4, junk: 5, trash: 6 }
    return rows
      .map((row) => ({
        accountId: row.account_id,
        path: row.path,
        name: row.name,
        specialUse: row.special_use,
        unread: Number(row.unread),
        total: Number(row.total)
      }))
      .sort((a, b) => (order[a.specialUse ?? ''] ?? 9) - (order[b.specialUse ?? ''] ?? 9) || a.path.localeCompare(b.path, 'de'))
  }

  findFolder(accountId: string, specialUse: Exclude<SpecialUse, null>): string | null {
    const row = this.db.prepare('SELECT path FROM folders WHERE account_id = ? AND special_use = ?').get(accountId, specialUse) as
      | { path: string }
      | undefined
    return row?.path ?? null
  }

  syncState(accountId: string, path: string): FolderSyncState {
    const row = this.db.prepare('SELECT uid_validity, last_uid FROM folders WHERE account_id = ? AND path = ?').get(accountId, path) as
      | { uid_validity: string | null; last_uid: number }
      | undefined
    return { uidValidity: row?.uid_validity ?? null, lastUid: row?.last_uid ?? 0 }
  }

  /**
   * Stores the sync state. If the server's UIDVALIDITY changed, the old
   * uids mean nothing anymore and the cached mails of the folder are dropped.
   */
  setSyncState(accountId: string, path: string, state: FolderSyncState): void {
    const current = this.syncState(accountId, path)
    transaction(this.db, () => {
      if (current.uidValidity && state.uidValidity && current.uidValidity !== state.uidValidity) {
        this.clearFolderMessages(accountId, path)
      }
      this.db
        .prepare('UPDATE folders SET uid_validity = ?, last_uid = ? WHERE account_id = ? AND path = ?')
        .run(state.uidValidity, state.lastUid, accountId, path)
    })
  }

  private removeFolder(accountId: string, path: string): void {
    this.clearFolderMessages(accountId, path)
    this.db.prepare('DELETE FROM folders WHERE account_id = ? AND path = ?').run(accountId, path)
  }

  private clearFolderMessages(accountId: string, path: string): void {
    const ids = this.db.prepare('SELECT id FROM messages WHERE account_id = ? AND folder = ?').all(accountId, path) as Array<{ id: number }>
    for (const { id } of ids) this.db.prepare('DELETE FROM messages_search WHERE rowid = ?').run(id)
    this.db.prepare('DELETE FROM messages WHERE account_id = ? AND folder = ?').run(accountId, path)
  }

  // ---------- Messages ----------

  /** Adds or updates mails. Returns the local ids of mails that were new. */
  upsertMessages(accountId: string, folder: string, mails: ParsedMail[]): number[] {
    const added: number[] = []
    transaction(this.db, () => {
      const existing = this.db.prepare('SELECT id FROM messages WHERE account_id = ? AND folder = ? AND uid = ?')
      const insert = this.db.prepare(
        `INSERT INTO messages (account_id, folder, uid, message_id, in_reply_to, refs, subject, from_json, to_json, cc_json,
           reply_to_json, date, seen, has_attachments, snippet, text, html, attachments_json, size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const indexSearch = this.db.prepare('INSERT INTO messages_search (rowid, subject, sender, body) VALUES (?, ?, ?, ?)')
      for (const mail of mails) {
        const found = existing.get(accountId, folder, mail.uid) as { id: number } | undefined
        if (found) {
          this.setSeen(found.id, mail.seen)
          continue
        }
        const result = insert.run(
          accountId,
          folder,
          mail.uid,
          mail.messageId,
          mail.inReplyTo,
          JSON.stringify(mail.references),
          mail.subject,
          mail.from ? JSON.stringify(mail.from) : null,
          JSON.stringify(mail.to),
          JSON.stringify(mail.cc),
          JSON.stringify(mail.replyTo),
          mail.date,
          mail.seen ? 1 : 0,
          mail.attachments.some((item) => !item.inline) ? 1 : 0,
          makeSnippet(mail.text),
          mail.text,
          mail.html,
          JSON.stringify(mail.attachments),
          mail.size
        )
        const id = Number(result.lastInsertRowid)
        const sender = mail.from ? `${mail.from.name} ${mail.from.address}` : ''
        indexSearch.run(id, mail.subject, sender, mail.text)
        added.push(id)
      }
    })
    return added
  }

  /** Newest first. */
  list(accountId: string, folder: string, limit = 200, offset = 0): MessageSummary[] {
    const rows = this.db
      .prepare(`SELECT ${SUMMARY_COLUMNS} FROM messages WHERE account_id = ? AND folder = ? ORDER BY date DESC LIMIT ? OFFSET ?`)
      .all(accountId, folder, limit, offset) as unknown as MessageRow[]
    return rows.map(toSummary)
  }

  get(id: number): MessageDetail | null {
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined
    if (!row) return null
    return {
      ...toSummary(row),
      text: row.text,
      html: row.html,
      attachments: parseJson<AttachmentInfo[]>(row.attachments_json, []),
      replyTo: parseJson<Address[]>(row.reply_to_json, [])
    }
  }

  uidsIn(accountId: string, folder: string): number[] {
    return (this.db.prepare('SELECT uid FROM messages WHERE account_id = ? AND folder = ?').all(accountId, folder) as Array<{ uid: number }>).map(
      (row) => row.uid
    )
  }

  setSeen(id: number, seen: boolean): void {
    this.db.prepare('UPDATE messages SET seen = ? WHERE id = ?').run(seen ? 1 : 0, id)
  }

  /** Removes a mail from the cache, e.g. after it was moved on the server. */
  remove(id: number): void {
    transaction(this.db, () => {
      this.db.prepare('DELETE FROM messages_search WHERE rowid = ?').run(id)
      this.db.prepare('DELETE FROM messages WHERE id = ?').run(id)
    })
  }

  /** Removes cached mails that no longer exist on the server. */
  removeUids(accountId: string, folder: string, uids: number[]): void {
    if (uids.length === 0) return
    const find = this.db.prepare('SELECT id FROM messages WHERE account_id = ? AND folder = ? AND uid = ?')
    for (const uid of uids) {
      const row = find.get(accountId, folder, uid) as { id: number } | undefined
      if (row) this.remove(row.id)
    }
  }

  /** Keeps only the newest `keep` mails of a folder. */
  prune(accountId: string, folder: string, keep: number): void {
    const old = this.db
      .prepare('SELECT id FROM messages WHERE account_id = ? AND folder = ? ORDER BY date DESC LIMIT -1 OFFSET ?')
      .all(accountId, folder, keep) as Array<{ id: number }>
    for (const { id } of old) this.remove(id)
  }

  /** Full-text search in sender, subject and text. */
  search(input: string, options: { accountId?: string; limit?: number } = {}): MessageSummary[] {
    const query = buildSearchQuery(input)
    if (!query) return []
    const rows = this.db
      .prepare(
        `SELECT ${SUMMARY_COLUMNS.split(', ').map((column) => `m.${column}`).join(', ')}
         FROM messages_search s JOIN messages m ON m.id = s.rowid
         WHERE messages_search MATCH ? AND (? IS NULL OR m.account_id = ?)
         ORDER BY m.date DESC LIMIT ?`
      )
      .all(query, options.accountId ?? null, options.accountId ?? null, options.limit ?? 100) as unknown as MessageRow[]
    return rows.map(toSummary)
  }

  /** Finds a cached mail by its Message-ID header. */
  findByMessageId(messageId: string): MessageSummary | null {
    const row = this.db.prepare(`SELECT ${SUMMARY_COLUMNS} FROM messages WHERE message_id = ? LIMIT 1`).get(messageId) as MessageRow | undefined
    return row ? toSummary(row) : null
  }

  removeAccount(accountId: string): void {
    transaction(this.db, () => {
      for (const { path } of this.db.prepare('SELECT path FROM folders WHERE account_id = ?').all(accountId) as Array<{ path: string }>) {
        this.removeFolder(accountId, path)
      }
    })
  }
}
