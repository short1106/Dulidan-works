import { randomUUID } from 'node:crypto'
import type { Database } from './sqlite'

/** A mail that is being written. Stored locally until it is sent or thrown away. */
export interface Draft {
  id: string
  accountId: string
  to: string
  cc: string
  bcc: string
  subject: string
  html: string
  /** Attachments as base64, so a draft survives a restart. */
  attachments: Array<{ filename: string; contentType: string; base64: string }>
  inReplyTo: string | null
  references: string[]
  updatedAt: number
}

export type DraftInput = Omit<Draft, 'id' | 'updatedAt'> & { id?: string }

export class DraftStore {
  constructor(private readonly db: Database) {
    db.exec('CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL)')
  }

  save(input: DraftInput, now = Date.now()): Draft {
    const draft: Draft = { ...input, id: input.id ?? randomUUID(), updatedAt: now }
    this.db
      .prepare(
        `INSERT INTO drafts (id, account_id, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET account_id = excluded.account_id, data = excluded.data, updated_at = excluded.updated_at`
      )
      .run(draft.id, draft.accountId, JSON.stringify(draft), now)
    return draft
  }

  list(): Draft[] {
    return (this.db.prepare('SELECT data FROM drafts ORDER BY updated_at DESC').all() as Array<{ data: string }>).map((row) => JSON.parse(row.data) as Draft)
  }

  get(id: string): Draft | null {
    const row = this.db.prepare('SELECT data FROM drafts WHERE id = ?').get(id) as { data: string } | undefined
    return row ? (JSON.parse(row.data) as Draft) : null
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM drafts WHERE id = ?').run(id)
  }

  removeAccount(accountId: string): void {
    this.db.prepare('DELETE FROM drafts WHERE account_id = ?').run(accountId)
  }
}
