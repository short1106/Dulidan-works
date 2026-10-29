import { ATTACHMENTS_DIR, folderOf } from './names'

/**
 * Pictures live in the "attachments" folder of the notes folder. In the
 * file, a note links to them relative to its own place (so other Markdown
 * programs find them): "attachments/x.png", or "../attachments/x.png" for
 * a note in a sub folder. Inside Cortex the window loads them through the
 * address "cortex://attachments/x.png".
 */
export const ATTACHMENT_URL = 'cortex://attachments/'

/** Address in the file -> address in the window. Other addresses stay unchanged. */
export function attachmentUrlFromFile(src: string, notePath: string): string {
  const name = attachmentNameFromFile(src, notePath)
  return name ? ATTACHMENT_URL + encodeURIComponent(name) : src
}

/** File name inside the attachments folder, if the address points there. */
export function attachmentNameFromFile(src: string, notePath: string): string | null {
  let value: string
  try {
    value = decodeURIComponent(src.trim())
  } catch {
    value = src.trim()
  }
  const parts = [...folderOf(notePath).split('/').filter(Boolean)]
  for (const part of value.replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) return null
      parts.pop()
    } else parts.push(part)
  }
  if (parts.length !== 2 || parts[0] !== ATTACHMENTS_DIR) return null
  return parts[1]!
}

/** Address in the window -> address in the file, relative to the note. */
export function attachmentUrlToFile(src: string, notePath: string): string {
  if (!src.startsWith(ATTACHMENT_URL)) return src
  const name = decodeURIComponent(src.slice(ATTACHMENT_URL.length))
  const depth = folderOf(notePath).split('/').filter(Boolean).length
  return `${'../'.repeat(depth)}${ATTACHMENTS_DIR}/${encodeURI(name)}`
}

/** Safe file name for a new attachment, e.g. "bild-20261029-171501-a3f9.png". */
export function attachmentFileName(originalName: string, now: Date, random: string): string {
  const dot = originalName.lastIndexOf('.')
  const ext = dot > 0 ? originalName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : ''
  const stem = (dot > 0 ? originalName.slice(0, dot) : originalName)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'datei'
  const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
  return `${stem}-${stamp}-${random}${ext ? `.${ext}` : ''}`
}

const REFERENCE = /(\]\(<?)([^)\s>]+)|(<img\b[^>]*?\ssrc\s*=\s*["'])([^"']+)/gi

/**
 * When a note moves to another folder, its picture and file links must
 * point one folder further up or down. Other addresses stay unchanged.
 */
export function rebaseAttachmentRefs(markdown: string, fromPath: string, toPath: string): string {
  if (folderOf(fromPath) === folderOf(toPath)) return markdown
  return markdown.replace(REFERENCE, (whole, mdStart?: string, mdSrc?: string, htmlStart?: string, htmlSrc?: string) => {
    const name = attachmentNameFromFile(mdSrc ?? htmlSrc ?? '', fromPath)
    if (!name) return whole
    return `${mdStart ?? htmlStart}${attachmentUrlToFile(ATTACHMENT_URL + encodeURIComponent(name), toPath)}`
  })
}

/** Names of all attachments a note uses. */
export function attachmentRefs(markdown: string, notePath: string): string[] {
  const names = new Set<string>()
  for (const match of markdown.matchAll(REFERENCE)) {
    const name = attachmentNameFromFile(match[2] ?? match[4] ?? '', notePath)
    if (name) names.add(name)
  }
  return [...names]
}
