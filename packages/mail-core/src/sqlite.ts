import { createRequire } from 'node:module'
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite'

/**
 * The SQLite database built into Node and Electron (no extra library).
 * Loaded with require, so bundlers and test runners leave it alone.
 */
const require = createRequire(import.meta.url)

export type Database = DatabaseSyncType

export function openDatabase(file: string): Database {
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;')
  return db
}

/** Runs several statements as one unit: all or nothing. */
export function transaction<T>(db: Database, work: () => T): T {
  db.exec('BEGIN')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
