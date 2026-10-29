/**
 * Links between notes: [[Notiztitel]] or [[Notiztitel|anderer Text]].
 * The link points to the note with that title (upper/lower case ignored).
 */

const WIKI_LINK = /\[\[([^\[\]\n|]+?)(\|[^\[\]\n]*)?\]\]/g

/** Key for comparing titles: trimmed, lower case, single spaces. */
export function linkKey(title: string): string {
  return title.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
}

/** Removes code blocks and inline code, where [[...]] is not a link. */
function withoutCode(markdown: string): string {
  return markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '')
}

export interface WikiLink {
  target: string
  label: string | null
}

export function findWikiLinks(markdown: string): WikiLink[] {
  const links: WikiLink[] = []
  for (const match of withoutCode(markdown).matchAll(WIKI_LINK)) {
    const target = match[1]!.trim()
    if (target) links.push({ target, label: match[2] ? match[2].slice(1).trim() || null : null })
  }
  return links
}

/** The distinct link keys of a note, for the index. */
export function linkKeys(markdown: string): string[] {
  return [...new Set(findWikiLinks(markdown).map((link) => linkKey(link.target)))]
}

/**
 * After renaming a note: changes [[Alter Titel]] into [[Neuer Titel]].
 * A label (the text after "|") stays as it is.
 */
export function renameWikiLinks(markdown: string, oldTitle: string, newTitle: string): string {
  const oldKey = linkKey(oldTitle)
  return markdown.replace(WIKI_LINK, (whole, target: string, label: string | undefined) =>
    linkKey(target) === oldKey ? `[[${newTitle}${label ?? ''}]]` : whole
  )
}

/** Text typed after "[[" that is not closed yet, for the suggestion list. */
export function openLinkQuery(textBeforeCursor: string): string | null {
  const start = textBeforeCursor.lastIndexOf('[[')
  if (start === -1) return null
  const query = textBeforeCursor.slice(start + 2)
  if (/[\]\n|]/.test(query) || query.length > 100) return null
  return query
}
