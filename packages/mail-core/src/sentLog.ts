import type { Database } from './sqlite'
import { startOfLocalDay, DEFAULT_TIME_ZONE } from './calendar/time'
import type { Address } from './types'

/**
 * Remembers every sent mail. Used to
 *   - recognize replies (In-Reply-To / References point to a sent Message-ID),
 *   - keep the daily send limit,
 *   - let Radar connect replies to its contacts (via `tag`).
 */

export interface SentRecord {
  messageId: string
  accountId: string
  to: Address[]
  subject: string
  sentAt: number
  /** Free label of the sending program, e.g. a Radar campaign. */
  tag: string | null
}

export interface ReplyEvent {
  /** The mail that was sent by us. */
  original: SentRecord
  /** Local cache id of the reply. */
  replyId: number
  replyMessageId: string | null
  from: Address | null
  subject: string
  date: number
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sent_log (
  message_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  to_json TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  tag TEXT
);
CREATE INDEX IF NOT EXISTS sent_log_account_time ON sent_log (account_id, sent_at);
CREATE TABLE IF NOT EXISTS replies (
  reply_key TEXT PRIMARY KEY,
  original_message_id TEXT NOT NULL,
  detected_at INTEGER NOT NULL
);
`

/** Normalizes Message-IDs, so "<a@b>" and "a@b" match. */
export function normalizeMessageId(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/^<|>$/g, '').toLowerCase()
  return trimmed ? trimmed : null
}

/**
 * Finds which sent mail an incoming mail answers. In-Reply-To is checked
 * first, then References from the newest to the oldest.
 */
export function findOriginalId(
  incoming: { inReplyTo: string | null; references: string[] },
  isSent: (normalizedId: string) => boolean
): string | null {
  const candidates = [incoming.inReplyTo, ...[...incoming.references].reverse()]
  for (const candidate of candidates) {
    const id = normalizeMessageId(candidate)
    if (id && isSent(id)) return id
  }
  return null
}

export class SentLog {
  constructor(private readonly db: Database) {
    db.exec(SCHEMA)
  }

  record(entry: SentRecord): void {
    this.db
      .prepare('INSERT OR REPLACE INTO sent_log (message_id, account_id, to_json, subject, sent_at, tag) VALUES (?, ?, ?, ?, ?, ?)')
      .run(normalizeMessageId(entry.messageId), entry.accountId, JSON.stringify(entry.to), entry.subject, entry.sentAt, entry.tag)
  }

  get(messageId: string): SentRecord | null {
    const row = this.db.prepare('SELECT * FROM sent_log WHERE message_id = ?').get(normalizeMessageId(messageId)) as
      | { message_id: string; account_id: string; to_json: string; subject: string; sent_at: number; tag: string | null }
      | undefined
    if (!row) return null
    return { messageId: row.message_id, accountId: row.account_id, to: JSON.parse(row.to_json) as Address[], subject: row.subject, sentAt: row.sent_at, tag: row.tag }
  }

  has(normalizedId: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM sent_log WHERE message_id = ?').get(normalizedId)
  }

  /** Mails sent by an account since the start of today (local time). */
  countToday(accountId: string, now = Date.now(), timeZone = DEFAULT_TIME_ZONE): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS count FROM sent_log WHERE account_id = ? AND sent_at >= ?')
      .get(accountId, startOfLocalDay(now, timeZone)) as { count: number }
    return Number(row.count)
  }

  /**
   * Checks an incoming mail. Returns the reply event the first time a
   * reply to one of our mails is seen, otherwise null.
   */
  detectReply(mail: { id: number; messageId: string | null; inReplyTo: string | null; references: string[]; from: Address | null; subject: string; date: number }): ReplyEvent | null {
    const originalId = findOriginalId(mail, (id) => this.has(id))
    if (!originalId) return null
    const key = normalizeMessageId(mail.messageId) ?? `local:${mail.id}`
    const inserted = this.db
      .prepare('INSERT OR IGNORE INTO replies (reply_key, original_message_id, detected_at) VALUES (?, ?, ?)')
      .run(key, originalId, Date.now())
    if (Number(inserted.changes) === 0) return null
    return { original: this.get(originalId)!, replyId: mail.id, replyMessageId: mail.messageId, from: mail.from, subject: mail.subject, date: mail.date }
  }
}

export class DailyLimitReachedError extends Error {
  constructor(
    readonly limit: number,
    readonly sentToday: number
  ) {
    super(`Daily limit of ${limit} mails reached (${sentToday} sent today).`)
    this.name = 'DailyLimitReachedError'
  }
}
