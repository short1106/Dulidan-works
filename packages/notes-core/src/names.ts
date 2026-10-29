/**
 * File and folder names inside the notes folder. Paths are always written
 * with "/" (also on Windows) and are relative to the notes folder.
 */

/** Folder for pictures and other files inserted into notes. */
export const ATTACHMENTS_DIR = 'attachments'
/** Folder of the trash (hidden, so other programs do not list it as notes). */
export const TRASH_DIR = '.papierkorb'
/** Folder for quick notes ("Schnellnotiz"). */
export const INBOX_DIR = 'Posteingang'
export const NOTE_EXT = '.md'
export const UNTITLED = 'Unbenannt'

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const MAX_NAME = 100

/** Turns a title into a safe file or folder name for Windows, macOS and Linux. */
export function safeName(title: string, fallback = UNTITLED): string {
  let name = title
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
  if (name.length > MAX_NAME) name = name.slice(0, MAX_NAME).trim()
  if (!name) name = fallback
  if (RESERVED.test(name)) name = `${name}_`
  return name
}

/** "Name.md", or "Name 2.md", "Name 3.md", ... if the name is taken. */
export function uniqueName(base: string, ext: string, taken: (name: string) => boolean): string {
  if (!taken(base + ext)) return base + ext
  for (let counter = 2; ; counter++) {
    const name = `${base} ${counter}${ext}`
    if (!taken(name)) return name
  }
}

export function joinPath(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name
}

export function folderOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export function titleFromFileName(path: string): string {
  const name = baseName(path)
  return name.toLowerCase().endsWith(NOTE_EXT) ? name.slice(0, -NOTE_EXT.length) : name
}

/** True for folders that hold no notes of their own (hidden folders, attachments, trash). */
export function isSpecialSegment(segment: string): boolean {
  return segment.startsWith('.') || segment === ATTACHMENTS_DIR || segment === 'node_modules'
}

/**
 * Checks a path coming from the window: relative, no "..", no hidden or
 * special folders. Returns the cleaned path or null.
 */
export function cleanRelativePath(path: string, { allowEmpty = false } = {}): string | null {
  if (typeof path !== 'string') return null
  const parts = path.replace(/\\/g, '/').split('/').filter((part) => part !== '' && part !== '.')
  if (parts.length === 0) return allowEmpty ? '' : null
  if (parts.some((part) => part === '..' || isSpecialSegment(part) || /[<>:"|?*\u0000-\u001f]/.test(part))) return null
  return parts.join('/')
}

export function isNotePath(path: string): boolean {
  return path.toLowerCase().endsWith(NOTE_EXT) && cleanRelativePath(path) !== null
}
