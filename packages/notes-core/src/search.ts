/**
 * Search words typed by the user become a query for SQLite's full text
 * search (FTS5). Every word must appear; a word also matches longer words
 * that start with it ("Kuch" finds "Kuchen"). Special characters are
 * removed, so typing never causes an error.
 */
export function ftsQuery(input: string): string | null {
  const words = input
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 12)
  if (words.length === 0) return null
  return words.map((word) => `"${word}"*`).join(' ')
}
