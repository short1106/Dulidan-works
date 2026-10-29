import { randomBytes } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, rmdir, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { atomicWriteFile } from '@dulidan/core/node'
import { attachmentFileName } from '../attachments'
import { normalizeTag, parseNote, serializeNote } from '../frontMatter'
import {
  ATTACHMENTS_DIR,
  baseName,
  cleanRelativePath,
  folderOf,
  isSpecialSegment,
  joinPath,
  NOTE_EXT,
  safeName,
  titleFromFileName,
  TRASH_DIR,
  uniqueName,
  UNTITLED
} from '../names'
import { mayDeleteForGood, trashDaysLeft } from '../trash'
import type { Note, NoteColor, NoteMeta, TrashEntry } from '../types'

export interface FileStamp {
  mtimeMs: number
  size: number
}

export interface LoadedNote extends FileStamp {
  path: string
  note: Note
}

export interface NewNote {
  folder?: string
  title?: string
  body?: string
  color?: NoteColor | null
  tags?: string[]
}

export class VaultError extends Error {
  constructor(
    readonly code: 'not-found' | 'invalid-path' | 'folder-not-empty' | 'exists' | 'too-early' | 'conflict',
    message?: string
  ) {
    super(message ?? code)
  }
}

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false
  )

/**
 * The notes folder on disk ("Tresor"): every note is one Markdown file,
 * pictures are in "attachments", the trash is the hidden ".papierkorb"
 * folder. All paths given to and returned by this class are relative to
 * the notes folder and use "/".
 */
export class Vault {
  readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  /** Absolute path of a relative path; refuses anything outside the notes folder. */
  abs(path: string): string {
    const full = resolve(this.root, ...path.split('/'))
    if (full !== this.root && !full.startsWith(this.root + sep)) throw new VaultError('invalid-path', path)
    return full
  }

  private notePath(path: string): string {
    const clean = cleanRelativePath(path)
    if (!clean || !clean.toLowerCase().endsWith(NOTE_EXT)) throw new VaultError('invalid-path', path)
    return clean
  }

  private folderPath(folder: string | undefined): string {
    const clean = cleanRelativePath(folder ?? '', { allowEmpty: true })
    if (clean === null) throw new VaultError('invalid-path', folder)
    return clean
  }

  async ensure(): Promise<void> {
    await mkdir(this.root, { recursive: true })
  }

  /** All note files (not in the trash), with size and change time. */
  async listNotes(): Promise<Array<FileStamp & { path: string }>> {
    const result: Array<FileStamp & { path: string }> = []
    const walk = async (folder: string): Promise<void> => {
      const entries = await readdir(this.abs(folder), { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (isSpecialSegment(entry.name)) continue
        const path = joinPath(folder, entry.name)
        if (entry.isDirectory()) await walk(path)
        else if (entry.isFile() && entry.name.toLowerCase().endsWith(NOTE_EXT)) {
          const info = await stat(this.abs(path)).catch(() => null)
          if (info) result.push({ path, mtimeMs: info.mtimeMs, size: info.size })
        }
      }
    }
    await walk('')
    return result
  }

  /** All folders, sorted, e.g. ["Arbeit", "Arbeit/Kunden", "Rezepte"]. */
  async listFolders(): Promise<string[]> {
    const result: string[] = []
    const walk = async (folder: string): Promise<void> => {
      const entries = await readdir(this.abs(folder), { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (!entry.isDirectory() || isSpecialSegment(entry.name)) continue
        const path = joinPath(folder, entry.name)
        result.push(path)
        await walk(path)
      }
    }
    await walk('')
    return result.sort((a, b) => a.localeCompare(b, 'de'))
  }

  async stamp(path: string): Promise<FileStamp | null> {
    const info = await stat(this.abs(path)).catch(() => null)
    return info ? { mtimeMs: info.mtimeMs, size: info.size } : null
  }

  async read(path: string): Promise<LoadedNote> {
    return this.readAt(this.notePath(path), path)
  }

  private async readAt(full: string, path: string): Promise<LoadedNote> {
    const file = this.abs(full)
    const [text, info] = await Promise.all([readFile(file, 'utf8'), stat(file)]).catch(() => {
      throw new VaultError('not-found', path)
    })
    const created = new Date(info.birthtimeMs > 0 ? info.birthtimeMs : info.mtimeMs).toISOString()
    const note = parseNote(text, { title: titleFromFileName(path), created, modified: new Date(info.mtimeMs).toISOString() })
    return { path: full, note, mtimeMs: info.mtimeMs, size: info.size }
  }

  /** Writes a note safely (temporary file, then rename). */
  async write(path: string, note: Note): Promise<FileStamp> {
    const clean = this.notePath(path)
    await mkdir(this.abs(folderOf(clean)), { recursive: true })
    await atomicWriteFile(this.abs(clean), serializeNote(note))
    return (await this.stamp(clean))!
  }

  private async freeName(folder: string, base: string, ext: string, except?: string): Promise<string> {
    const names = new Set((await readdir(this.abs(folder)).catch(() => [] as string[])).map((name) => name.toLowerCase()))
    if (except) names.delete(except.toLowerCase())
    return uniqueName(base, ext, (name) => names.has(name.toLowerCase()))
  }

  async create(input: NewNote = {}, now = new Date()): Promise<LoadedNote> {
    const folder = this.folderPath(input.folder)
    await mkdir(this.abs(folder), { recursive: true })
    const title = input.title?.trim() || UNTITLED
    const name = await this.freeName(folder, safeName(title), NOTE_EXT)
    const path = joinPath(folder, name)
    const iso = now.toISOString()
    // A new "Unbenannt" note gets the free file name as title ("Unbenannt 2").
    const meta: NoteMeta = {
      title: input.title?.trim() ? title : titleFromFileName(name),
      tags: (input.tags ?? []).map(normalizeTag).filter(Boolean),
      created: iso,
      modified: iso,
      pinned: false,
      color: input.color ?? null,
      deleted: null,
      original: null,
      extra: []
    }
    const note: Note = { meta, body: input.body ?? '' }
    const stamp = await this.write(path, note)
    return { path, note, ...stamp }
  }

  /** New title: the file gets the matching name. Returns the new path. */
  async rename(path: string, newTitle: string): Promise<LoadedNote> {
    const current = await this.read(path)
    const title = newTitle.trim() || UNTITLED
    const folder = folderOf(current.path)
    const name = await this.freeName(folder, safeName(title), NOTE_EXT, baseName(current.path))
    const target = joinPath(folder, name)
    const note: Note = { meta: { ...current.note.meta, title, modified: new Date().toISOString() }, body: current.note.body }
    if (target !== current.path && target.toLowerCase() === current.path.toLowerCase()) {
      // Only upper/lower case changes: rename the file itself, then write.
      await rename(this.abs(current.path), this.abs(target))
      return { path: target, note, ...(await this.write(target, note)) }
    }
    // First write the new file, then remove the old one: never a moment without the note.
    const stamp = await this.write(target, note)
    if (target !== current.path) await rm(this.abs(current.path), { force: true })
    return { path: target, note, ...stamp }
  }

  async move(path: string, folder: string): Promise<string> {
    const source = this.notePath(path)
    const targetFolder = this.folderPath(folder)
    if (folderOf(source) === targetFolder) return source
    await mkdir(this.abs(targetFolder), { recursive: true })
    const name = await this.freeName(targetFolder, titleFromFileName(source), NOTE_EXT)
    const target = joinPath(targetFolder, name)
    await rename(this.abs(source), this.abs(target))
    return target
  }

  // ---------- Trash ----------

  /** Moves a note into the trash. It is written there first, then removed here. */
  async trash(path: string, now = new Date()): Promise<string> {
    const current = await this.read(path)
    const trashDir = this.abs(TRASH_DIR)
    await mkdir(trashDir, { recursive: true })
    const name = await this.freeName(TRASH_DIR, titleFromFileName(current.path), NOTE_EXT)
    const target = `${TRASH_DIR}/${name}`
    const note: Note = { meta: { ...current.note.meta, deleted: now.toISOString(), original: current.path }, body: current.note.body }
    await atomicWriteFile(join(trashDir, name), serializeNote(note))
    await rm(this.abs(current.path), { force: true })
    return target
  }

  private trashPath(path: string): string {
    const name = baseName(path.replace(/\\/g, '/'))
    if (!name.toLowerCase().endsWith(NOTE_EXT) || name.startsWith('.') || path.replace(/\\/g, '/') !== `${TRASH_DIR}/${name}`) {
      throw new VaultError('invalid-path', path)
    }
    return `${TRASH_DIR}/${name}`
  }

  async listTrash(now = Date.now()): Promise<TrashEntry[]> {
    const names = await readdir(this.abs(TRASH_DIR)).catch(() => [] as string[])
    const entries: TrashEntry[] = []
    for (const name of names) {
      if (!name.toLowerCase().endsWith(NOTE_EXT) || name.startsWith('.')) continue
      const path = `${TRASH_DIR}/${name}`
      try {
        const { note, mtimeMs } = await this.readAt(path, path)
        const deleted = note.meta.deleted ?? new Date(mtimeMs).toISOString()
        entries.push({ path, title: note.meta.title, original: note.meta.original ?? name, deleted, daysLeft: trashDaysLeft(deleted, now) })
      } catch {
        // A file that vanished meanwhile is simply not listed.
      }
    }
    return entries.sort((a, b) => b.deleted.localeCompare(a.deleted))
  }

  async readTrash(path: string): Promise<LoadedNote> {
    const clean = this.trashPath(path)
    return this.readAt(clean, clean)
  }

  /** Puts a note back where it was. If that name is taken now, it gets a number. */
  async restore(path: string): Promise<string> {
    const clean = this.trashPath(path)
    const { note } = await this.readAt(clean, clean)
    const original = cleanRelativePath(note.meta.original ?? '') ?? baseName(clean)
    let folder = folderOf(original)
    if (cleanRelativePath(folder, { allowEmpty: true }) === null) folder = ''
    await mkdir(this.abs(folder), { recursive: true })
    const name = await this.freeName(folder, titleFromFileName(original), NOTE_EXT)
    const target = joinPath(folder, name)
    await this.write(target, { meta: { ...note.meta, deleted: null, original: null }, body: note.body })
    await rm(this.abs(clean), { force: true })
    return target
  }

  /** Deletes a note from the trash for good; only after 30 days in the trash. */
  async deleteForGood(path: string, now = Date.now()): Promise<void> {
    const clean = this.trashPath(path)
    const { note, mtimeMs } = await this.readAt(clean, clean)
    if (!mayDeleteForGood(note.meta.deleted ?? new Date(mtimeMs).toISOString(), now)) throw new VaultError('too-early', clean)
    await rm(this.abs(clean), { force: true })
  }

  // ---------- Folders ----------

  async createFolder(parent: string, name: string): Promise<string> {
    const base = this.folderPath(parent)
    const folderName = safeName(name, 'Neuer Ordner')
    if (isSpecialSegment(folderName)) throw new VaultError('invalid-path', name)
    const path = joinPath(base, folderName)
    if (await exists(this.abs(path))) throw new VaultError('exists', path)
    await mkdir(this.abs(path), { recursive: true })
    return path
  }

  async renameFolder(path: string, name: string): Promise<string> {
    const source = this.folderPath(path)
    if (!source) throw new VaultError('invalid-path', path)
    const folderName = safeName(name, 'Neuer Ordner')
    if (isSpecialSegment(folderName)) throw new VaultError('invalid-path', name)
    const target = joinPath(folderOf(source), folderName)
    if (target === source) return source
    if (target.toLowerCase() !== source.toLowerCase() && (await exists(this.abs(target)))) throw new VaultError('exists', target)
    await rename(this.abs(source), this.abs(target))
    return target
  }

  /** Removes a folder; only if there are no files in it (empty sub folders are fine). */
  async removeFolder(path: string): Promise<void> {
    const folder = this.folderPath(path)
    if (!folder) throw new VaultError('invalid-path', path)
    const hasFiles = async (dir: string): Promise<boolean> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || (await hasFiles(join(dir, entry.name)))) return true
      }
      return false
    }
    if (await hasFiles(this.abs(folder))) throw new VaultError('folder-not-empty', folder)
    const removeEmpty = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) await removeEmpty(join(dir, entry.name))
      await rmdir(dir)
    }
    await removeEmpty(this.abs(folder))
  }

  // ---------- Attachments ----------

  /** Stores a picture or file in "attachments" and returns its file name there. */
  async saveAttachment(bytes: Uint8Array, originalName: string, now = new Date()): Promise<string> {
    await mkdir(this.abs(ATTACHMENTS_DIR), { recursive: true })
    const name = attachmentFileName(originalName, now, randomBytes(2).toString('hex'))
    await atomicWriteFile(this.abs(`${ATTACHMENTS_DIR}/${name}`), bytes)
    return name
  }

  /** Absolute path of an attachment, or null if the name is not a plain file name. */
  attachmentFile(name: string): string | null {
    if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.') || name !== baseName(name)) return null
    return this.abs(`${ATTACHMENTS_DIR}/${name}`)
  }

  /** Relative path of a file inside the notes folder, or null if it is outside. */
  relativeOf(absolutePath: string): string | null {
    const rel = relative(this.root, resolve(absolutePath))
    if (!rel || rel.startsWith('..') || resolve(this.root, rel) !== resolve(absolutePath)) return null
    return rel.split(sep).join('/')
  }
}
