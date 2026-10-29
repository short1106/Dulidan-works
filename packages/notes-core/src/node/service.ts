import { EventEmitter } from 'node:events'
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { atomicWriteFile } from '@dulidan/core/node'
import { attachmentRefs, rebaseAttachmentRefs } from '../attachments'
import { normalizeTag, parseNote, serializeNote } from '../frontMatter'
import { renameWikiLinks } from '../links'
import { plainTextToMarkdown } from '../markdown/serialize'
import { ATTACHMENTS_DIR, INBOX_DIR, titleFromFileName } from '../names'
import type { Note, NoteColor, NoteMeta, NoteSummary, TrashEntry } from '../types'
import { NoteIndex, type ListFilter, type SearchHit, type SyncResult } from './noteIndex'
import { Vault, VaultError, type LoadedNote, type NewNote } from './vault'
import { watchFolder } from './watcher'

export interface NotesServiceOptions {
  /** The notes folder. */
  root: string
  /** File of the search index (outside the notes folder). */
  indexFile: string
  /** Watch the folder for outside changes (default: yes). */
  watch?: boolean
}

export interface SaveInput {
  body?: string
  meta?: Partial<Pick<NoteMeta, 'tags' | 'pinned' | 'color'>>
  /** File time when the window loaded the note; if the file changed since, saving stops with "conflict". */
  expectedMtime?: number
}

export interface SavedNote {
  path: string
  mtimeMs: number
  modified: string
}

export interface RenameResult extends LoadedNote {
  /** How many other notes had their [[links]] updated. */
  updatedLinks: number
}

export interface NotesEvents {
  changed: [SyncResult]
}

const IMPORT_EXTENSIONS = ['.md', '.markdown', '.txt']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']

/**
 * Everything Cortex does with notes, in one place: the notes folder, the
 * search index and the watching for outside changes. All changes run one
 * after another, so a save and an outside change never get mixed up.
 */
export class NotesService extends EventEmitter<NotesEvents> {
  private queue: Promise<unknown> = Promise.resolve()
  private stopWatching: () => void = () => undefined

  private constructor(
    readonly vault: Vault,
    readonly index: NoteIndex
  ) {
    super()
  }

  static async open(options: NotesServiceOptions): Promise<NotesService> {
    const vault = new Vault(options.root)
    await vault.ensure()
    const service = new NotesService(vault, NoteIndex.open(options.indexFile, vault.root))
    await service.index.sync(vault)
    if (options.watch !== false) service.stopWatching = watchFolder(vault.root, () => void service.syncNow())
    return service
  }

  close(): void {
    this.stopWatching()
    this.index.close()
  }

  /** Runs changes one after another. */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work)
    this.queue = next.catch(() => undefined)
    return next
  }

  /** Reads outside changes into the index and tells the window. */
  syncNow(): Promise<SyncResult> {
    return this.serial(async () => {
      const result = await this.index.sync(this.vault)
      if (result.changed.length || result.removed.length) this.emit('changed', result)
      return result
    })
  }

  rebuildIndex(): Promise<number> {
    return this.serial(() => this.index.rebuild(this.vault))
  }

  // ---------- Reading ----------

  list(filter?: ListFilter): NoteSummary[] {
    return this.index.list(filter)
  }

  search(query: string, filter?: ListFilter): SearchHit[] {
    return this.index.search(query, filter)
  }

  load(path: string): Promise<LoadedNote> {
    return this.vault.read(path)
  }

  async folders(): Promise<{ folders: string[]; counts: Record<string, number> }> {
    return { folders: await this.vault.listFolders(), counts: this.index.folderCounts() }
  }

  tags(): Array<{ tag: string; count: number }> {
    return this.index.tags()
  }

  backlinks(path: string): NoteSummary[] {
    return this.index.backlinks(path)
  }

  resolveLink(title: string): string | null {
    return this.index.resolve(title)
  }

  suggest(text: string): Array<{ path: string; title: string }> {
    return this.index.suggest(text)
  }

  trash(): Promise<TrashEntry[]> {
    return this.vault.listTrash()
  }

  // ---------- Changing ----------

  private async putInIndex(path: string): Promise<LoadedNote> {
    const loaded = await this.vault.read(path)
    this.index.put(path, loaded.note, loaded)
    return loaded
  }

  create(input: NewNote = {}): Promise<LoadedNote> {
    return this.serial(async () => {
      const created = await this.vault.create(input)
      this.index.put(created.path, created.note, created)
      return created
    })
  }

  /** A quick note: into the "Posteingang" folder. */
  createQuickNote(title: string, body: string): Promise<LoadedNote> {
    return this.create({ folder: INBOX_DIR, title: title.trim() || undefined, body })
  }

  save(path: string, input: SaveInput): Promise<SavedNote> {
    return this.serial(async () => {
      const current = await this.vault.read(path)
      if (input.expectedMtime !== undefined && Math.abs(current.mtimeMs - input.expectedMtime) > 1) throw new VaultError('conflict', path)
      const meta: NoteMeta = { ...current.note.meta, ...input.meta, modified: new Date().toISOString() }
      if (input.meta?.tags) meta.tags = [...new Set(input.meta.tags.map(normalizeTag).filter(Boolean))]
      const note: Note = { meta, body: input.body ?? current.note.body }
      const stamp = await this.vault.write(path, note)
      this.index.put(path, note, stamp)
      return { path, mtimeMs: stamp.mtimeMs, modified: meta.modified }
    })
  }

  setPinned(path: string, pinned: boolean): Promise<SavedNote> {
    return this.save(path, { meta: { pinned } })
  }

  setColor(path: string, color: NoteColor | null): Promise<SavedNote> {
    return this.save(path, { meta: { color } })
  }

  setTags(path: string, tags: string[]): Promise<SavedNote> {
    return this.save(path, { meta: { tags } })
  }

  /** New title (and file name). Links [[Alter Titel]] in other notes are updated. */
  rename(path: string, title: string): Promise<RenameResult> {
    return this.serial(async () => {
      const before = await this.vault.read(path)
      const oldTitle = before.note.meta.title
      const renamed = await this.vault.rename(path, title)
      this.index.remove(path)
      this.index.put(renamed.path, renamed.note, renamed)
      let updatedLinks = 0
      if (oldTitle.trim().toLowerCase() !== renamed.note.meta.title.trim().toLowerCase()) {
        for (const source of this.index.linkingTo(oldTitle)) {
          if (source === renamed.path) continue
          const other = await this.vault.read(source)
          const body = renameWikiLinks(other.note.body, oldTitle, renamed.note.meta.title)
          if (body === other.note.body) continue
          const stamp = await this.vault.write(source, { meta: other.note.meta, body })
          this.index.put(source, { meta: other.note.meta, body }, stamp)
          updatedLinks++
        }
      }
      return { ...renamed, updatedLinks }
    })
  }

  move(path: string, folder: string): Promise<string> {
    return this.serial(async () => {
      const target = await this.vault.move(path, folder)
      this.index.remove(path)
      const moved = await this.vault.read(target)
      const body = rebaseAttachmentRefs(moved.note.body, path, target)
      if (body !== moved.note.body) {
        const stamp = await this.vault.write(target, { meta: moved.note.meta, body })
        this.index.put(target, { meta: moved.note.meta, body }, stamp)
      } else this.index.put(target, moved.note, moved)
      return target
    })
  }

  moveToTrash(path: string): Promise<string> {
    return this.serial(async () => {
      const target = await this.vault.trash(path)
      this.index.remove(path)
      return target
    })
  }

  restore(trashPath: string): Promise<string> {
    return this.serial(async () => {
      const target = await this.vault.restore(trashPath)
      await this.putInIndex(target)
      return target
    })
  }

  deleteForGood(trashPath: string): Promise<void> {
    return this.serial(() => this.vault.deleteForGood(trashPath))
  }

  createFolder(parent: string, name: string): Promise<string> {
    return this.serial(() => this.vault.createFolder(parent, name))
  }

  renameFolder(path: string, name: string): Promise<string> {
    return this.serial(async () => {
      const target = await this.vault.renameFolder(path, name)
      await this.index.sync(this.vault)
      return target
    })
  }

  removeFolder(path: string): Promise<void> {
    return this.serial(() => this.vault.removeFolder(path))
  }

  saveAttachment(bytes: Uint8Array, originalName: string): Promise<string> {
    return this.vault.saveAttachment(bytes, originalName)
  }

  // ---------- Import and export ----------

  /**
   * Imports Markdown and text files into a folder. Pictures next to a
   * Markdown file that it shows are copied into "attachments".
   */
  importFiles(files: string[], folder = ''): Promise<string[]> {
    return this.serial(async () => {
      const created: string[] = []
      for (const file of files) {
        const ext = extname(file).toLowerCase()
        if (!IMPORT_EXTENSIONS.includes(ext)) continue
        const text = await readFile(file, 'utf8')
        const info = await stat(file)
        const fallbackTitle = titleFromFileName(basename(file, ext) + '.md')
        let body: string
        let title = fallbackTitle
        let tags: string[] = []
        if (ext === '.txt') {
          body = plainTextToMarkdown(text)
        } else {
          const parsed = parseNote(text, { title: fallbackTitle, created: info.mtime.toISOString(), modified: info.mtime.toISOString() })
          title = parsed.meta.title
          tags = parsed.meta.tags
          body = await this.copyImportedImages(parsed.body, dirname(file))
        }
        // Imported pictures are written as seen from the notes folder itself.
        const note = await this.vault.create({ folder, title, body: rebaseAttachmentRefs(body, 'import.md', `${folder ? `${folder}/` : ''}import.md`), tags })
        this.index.put(note.path, note.note, note)
        created.push(note.path)
      }
      return created
    })
  }

  private async copyImportedImages(body: string, sourceDir: string): Promise<string> {
    const replacements = new Map<string, string>()
    const sources = [...body.matchAll(/!\[[^\]]*\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g), ...body.matchAll(/<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]!)
    for (const src of sources) {
      if (replacements.has(src) || /^[a-z]+:/i.test(src)) continue
      let decoded = src
      try {
        decoded = decodeURIComponent(src)
      } catch {
        // keep as written
      }
      const file = resolve(sourceDir, decoded)
      if (!IMAGE_EXTENSIONS.includes(extname(file).toLowerCase())) continue
      try {
        const name = await this.vault.saveAttachment(await readFile(file), basename(file))
        replacements.set(src, `${ATTACHMENTS_DIR}/${name}`)
      } catch {
        // Picture not found: the reference stays as it was.
      }
    }
    let result = body
    for (const [from, to] of replacements) result = result.split(`(${from}`).join(`(${to}`).split(`"${from}"`).join(`"${to}"`).split(`'${from}'`).join(`'${to}'`)
    return result
  }

  /**
   * Exports a note as a Markdown file. Its pictures are copied into an
   * "attachments" folder next to the exported file, so it works anywhere.
   */
  async exportMarkdown(path: string, targetFile: string, withHeader = true): Promise<void> {
    const { note } = await this.vault.read(path)
    const targetDir = dirname(targetFile)
    // The exported file is the "top folder" of its own attachments folder.
    const body = rebaseAttachmentRefs(note.body, path, 'export.md')
    const used = attachmentRefs(body, 'export.md')
    if (used.length > 0) {
      await mkdir(join(targetDir, ATTACHMENTS_DIR), { recursive: true })
      for (const name of used) {
        const source = this.vault.attachmentFile(name)
        if (source) await copyFile(source, join(targetDir, ATTACHMENTS_DIR, name)).catch(() => undefined)
      }
    }
    await atomicWriteFile(targetFile, withHeader ? serializeNote({ meta: note.meta, body }) : body)
  }
}
