/**
 * Trash rules: a note stays at least 30 days in the trash. Only after that
 * may it be deleted for good, and only after asking the user.
 */
export const TRASH_KEEP_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** Days left until the note may be deleted for good (0 = now). */
export function trashDaysLeft(deletedAt: string, now = Date.now()): number {
  const deleted = Date.parse(deletedAt)
  if (Number.isNaN(deleted)) return 0
  return Math.max(0, Math.ceil((deleted + TRASH_KEEP_DAYS * DAY_MS - now) / DAY_MS))
}

export function mayDeleteForGood(deletedAt: string, now = Date.now()): boolean {
  return trashDaysLeft(deletedAt, now) === 0
}
