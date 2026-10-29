/**
 * Rules for automatic saving and recovery, without any file access.
 * The file side lives in node/snapshotStore.ts.
 */

/** One automatic snapshot of a document. */
export interface SnapshotInfo {
  id: string
  savedAt: string
  size: number
}

/** How often a snapshot of an open document is written. */
export const AUTOSAVE_INTERVAL_MS = 30_000

/** How many snapshots per document are kept to go back to. */
export const MAX_SNAPSHOTS = 10

/** Ids for documents and snapshots: safe as folder and file names. */
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/

export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value)
}

/**
 * Snapshot id from a date. Sorting the ids as text sorts them by time.
 * A counter suffix keeps two snapshots in the same millisecond apart.
 */
export function snapshotId(date: Date, counter = 0): string {
  const stamp = date.toISOString().replace(/[-:.TZ]/g, '').toLowerCase()
  return counter > 0 ? `${stamp}-${counter}` : stamp
}

/** Turns a snapshot id back into its date. */
export function snapshotDate(id: string): Date {
  const digits = id.slice(0, 17)
  const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T${digits.slice(8, 10)}:${digits.slice(10, 12)}:${digits.slice(12, 14)}.${digits.slice(14, 17)}Z`
  return new Date(iso)
}

/** Returns the ids to delete so that only the newest `keep` remain. */
export function snapshotsToDelete(ids: readonly string[], keep = MAX_SNAPSHOTS): string[] {
  return [...ids].sort().reverse().slice(keep)
}
