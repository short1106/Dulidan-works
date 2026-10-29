import { openDatabase, transaction, type Database } from '@dulidan/core/node'
import { attachmentNameFromFile } from '../attachments'
import { linkKey, linkKeys } from '../links'
import { markdownToPlain } from '../markdown/parse'
import { folderOf } from '../names'
import { ftsQuery } from '../search'
import { isNoteColor, type Note, type NoteSummary } from '../types'
import type { FileStamp, Vault } from './vault'

/**
 * The search index: a SQLite database next to the settings (not in the
 * notes folder). It only stores copies of what is in the note files, so
 * it can be thrown away and rebuilt at any time ("Index neu aufbauen").
 */
const SCHEMA_VERSION = '1'
const EXCERPT_LENGTH = 240

export interface SearchHit extends NoteSummary {
  /** Text around the hit; the found words are between \u0001 and \u0002. */
  snippet: string
}

export interface SyncResult {
  changed: string[]
  removed: string[]
}

export interface ListFilter {
  folder?: string | null
  tag?: string | null
  pinnedOnly?: boolean
}

interface NoteRow {
  path: string
  folder: string
  title: string
  tags: string
  created: string
  modified: string
  pinned: number
  color: string | null
  excerpt: string
  tasks_done: number
  tasks_total: number
  image: string | null
}

const SUMMARY_COLUMNS = 'n.path, n.folder, n.title, n.tags, n.created, n.modified, n.pinned, n.color, n.excerpt, n.tasks_done, n.tasks_total, n.image'

function toSummary(row: NoteRow): NoteSummary {
  let tags: string[] = []
  try {
    tags = JSON.parse(row.tags) as string[]
  } catch {
    tags = []
  }
  return {
    path: row.path,
    folder: row.folder,
    title: row.title,
    tags,
    created: row.created,
    modified: row.modified,
    pinned: row.pinned === 1,
    color: isNoteColor(row.color) ? row.color : null,
    excerpt: row.excerpt,
    tasksDone: row.tasks_done,
    tasksTotal: row.tasks_total,
    image: row.image
  }
}

export class NoteIndex {
  private constructor(private readonly db: Database) {}

  /** Opens (or creates) the index. A different notes folder or an old format means: start empty. */
  static open(file: string, vaultRoot: string): NoteIndex {
    const db = openDatabase(file)
    const index = new NoteIndex(db)
    db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    const get = (key: string): string | undefined => (db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined)?.value
    if (get('schema') !== SCHEMA_VERSION || get('root') !== vaultRoot) index.reset(vaultRoot)
    return index
  }

  private reset(vaultRoot: string): void {
    this.db.exec(`
      DROP TABLE IF EXISTS notes;
      DROP TABLE IF EXISTS links;
      DROP TABLE IF EXISTS notes_fts;
      CREATE TABLE notes (
        path TEXT PRIMARY KEY,
        folder TEXT NOT NULL,
        title TEXT NOT NULL,
        title_key TEXT NOT NULL,
        file_key TEXT NOT NULL,
        tags TEXT NOT NULL,
        created TEXT NOT NULL,
        modified TEXT NOT NULL,
        pinned INTEGER NOT NULL,
        color TEXT,
        excerpt TEXT NOT NULL,
        tasks_done INTEGER NOT NULL,
        tasks_total INTEGER NOT NULL,
        image TEXT,
        mtime REAL NOT NULL,
        size INTEGER NOT NULL
      );
      CREATE INDEX notes_title ON notes (title_key);
      CREATE INDEX notes_folder ON notes (folder);
      CREATE TABLE links (source TEXT NOT NULL, target_key TEXT NOT NULL);
      CREATE INDEX links_target ON links (target_key);
      CREATE INDEX links_source ON links (source);
      CREATE VIRTUAL TABLE notes_fts USING fts5(path UNINDEXED, title, body, tokenize = 'unicode61 remove_diacritics 2');
    `)
    const set = this.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
    set.run('schema', SCHEMA_VERSION)
    set.run('root', vaultRoot)
  }

  close(): void {
    this.db.close()
  }

  get count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS count FROM notes').get() as { count: number }).count
  }

  /** Adds or updates one note in the index. */
  put(path: string, note: Note, stamp: FileStamp): void {
    const plain = markdownToPlain(note.body)
    const image = plain.firstImage ? attachmentNameFromFile(plain.firstImage, path) : null
    const fileName = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '')
    transaction(this.db, () => {
      this.removeRows(path)
      this.db
        .prepare(
          `INSERT INTO notes (path, folder, title, title_key, file_key, tags, created, modified, pinned, color, excerpt, tasks_done, tasks_total, image, mtime, size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          path,
          folderOf(path),
          note.meta.title,
          linkKey(note.meta.title),
          linkKey(fileName),
          JSON.stringify(note.meta.tags),
          note.meta.created,
          note.meta.modified,
          note.meta.pinned ? 1 : 0,
          note.meta.color,
          plain.text.slice(0, EXCERPT_LENGTH),
          plain.tasksDone,
          plain.tasksTotal,
          image,
          stamp.mtimeMs,
          stamp.size
        )
      this.db.prepare('INSERT INTO notes_fts (path, title, body) VALUES (?, ?, ?)').run(path, note.meta.title, `${plain.text} ${note.meta.tags.join(' ')}`)
      const addLink = this.db.prepare('INSERT INTO links (source, target_key) VALUES (?, ?)')
      for (const key of linkKeys(note.body)) addLink.run(path, key)
    })
  }

  private removeRows(path: string): void {
    this.db.prepare('DELETE FROM notes WHERE path = ?').run(path)
    this.db.prepare('DELETE FROM notes_fts WHERE path = ?').run(path)
    this.db.prepare('DELETE FROM links WHERE source = ?').run(path)
  }

  remove(path: string): void {
    transaction(this.db, () => this.removeRows(path))
  }

  /**
   * Brings the index up to date with the files: new and changed files are
   * read again, missing ones removed. Unchanged files (same time and size)
   * are skipped, so this is fast even with thousands of notes.
   */
  async sync(vault: Vault): Promise<SyncResult> {
    const files = await vault.listNotes()
    const known = new Map(
      (this.db.prepare('SELECT path, mtime, size FROM notes').all() as Array<{ path: string; mtime: number; size: number }>).map((row) => [row.path, row])
    )
    const changed: string[] = []
    for (const file of files) {
      const row = known.get(file.path)
      known.delete(file.path)
      if (row && row.mtime === file.mtimeMs && row.size === file.size) continue
      try {
        const loaded = await vault.read(file.path)
        this.put(file.path, loaded.note, loaded)
        changed.push(file.path)
      } catch {
        // Unreadable right now (e.g. being written): the next sync tries again.
      }
    }
    const removed = [...known.keys()]
    for (const path of removed) this.remove(path)
    return { changed, removed }
  }

  /** Throws everything away and reads all files again. */
  async rebuild(vault: Vault): Promise<number> {
    transaction(this.db, () => {
      this.db.exec('DELETE FROM notes; DELETE FROM notes_fts; DELETE FROM links;')
    })
    await this.sync(vault)
    return this.count
  }

  /** Notes for the list: pinned first, then the most recently changed. */
  list(filter: ListFilter = {}): NoteSummary[] {
    const where: string[] = []
    const params: Array<string | number> = []
    if (filter.folder != null) {
      where.push('n.folder = ?')
      params.push(filter.folder)
    }
    if (filter.tag) {
      where.push('EXISTS (SELECT 1 FROM json_each(n.tags) WHERE json_each.value = ?)')
      params.push(filter.tag)
    }
    if (filter.pinnedOnly) where.push('n.pinned = 1')
    const sql = `SELECT ${SUMMARY_COLUMNS} FROM notes n ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY n.pinned DESC, n.modified DESC`
    return (this.db.prepare(sql).all(...params) as unknown as NoteRow[]).map(toSummary)
  }

  get(path: string): NoteSummary | null {
    const row = this.db.prepare(`SELECT ${SUMMARY_COLUMNS} FROM notes n WHERE n.path = ?`).get(path) as NoteRow | undefined
    return row ? toSummary(row) : null
  }

  /** Full text search over title and text; title hits count more. */
  search(input: string, filter: ListFilter = {}, limit = 200): SearchHit[] {
    const query = ftsQuery(input)
    if (!query) return []
    const where = ['notes_fts MATCH ?']
    const params: Array<string | number> = [query]
    if (filter.folder != null) {
      where.push('n.folder = ?')
      params.push(filter.folder)
    }
    if (filter.tag) {
      where.push('EXISTS (SELECT 1 FROM json_each(n.tags) WHERE json_each.value = ?)')
      params.push(filter.tag)
    }
    params.push(limit)
    const rows = this.db
      .prepare(
        `SELECT ${SUMMARY_COLUMNS}, snippet(notes_fts, 2, char(1), char(2), '…', 14) AS snippet
         FROM notes_fts JOIN notes n ON n.path = notes_fts.path
         WHERE ${where.join(' AND ')}
         ORDER BY bm25(notes_fts, 0, 8, 1)
         LIMIT ?`
      )
      .all(...params) as unknown as Array<NoteRow & { snippet: string }>
    return rows.map((row) => ({ ...toSummary(row), snippet: row.snippet }))
  }

  /** The note a [[link]] points to: same title, else same file name. */
  resolve(title: string): string | null {
    const key = linkKey(title)
    const row = (this.db.prepare('SELECT path FROM notes WHERE title_key = ? ORDER BY modified DESC LIMIT 1').get(key) ??
      this.db.prepare('SELECT path FROM notes WHERE file_key = ? ORDER BY modified DESC LIMIT 1').get(key)) as { path: string } | undefined
    return row?.path ?? null
  }

  /** "Diese Notizen verlinken hierher": notes that contain [[title]] of this note. */
  backlinks(path: string): NoteSummary[] {
    const note = this.db.prepare('SELECT title_key, file_key FROM notes WHERE path = ?').get(path) as { title_key: string; file_key: string } | undefined
    if (!note) return []
    return (
      this.db
        .prepare(
          `SELECT DISTINCT ${SUMMARY_COLUMNS} FROM links l JOIN notes n ON n.path = l.source
           WHERE l.target_key IN (?, ?) AND n.path != ? ORDER BY n.modified DESC`
        )
        .all(note.title_key, note.file_key, path) as unknown as NoteRow[]
    ).map(toSummary)
  }

  /** Notes that link to a title (used when renaming a note). */
  linkingTo(title: string): string[] {
    return (this.db.prepare('SELECT DISTINCT source FROM links WHERE target_key = ?').all(linkKey(title)) as Array<{ source: string }>).map((row) => row.source)
  }

  /** Titles for the suggestion list after "[[": titles starting with the text first. */
  suggest(text: string, limit = 8): Array<{ path: string; title: string }> {
    const key = linkKey(text).replace(/[\\%_]/g, (char) => `\\${char}`)
    return this.db
      .prepare(
        `SELECT path, title FROM notes WHERE title_key LIKE ? ESCAPE '\\'
         ORDER BY CASE WHEN title_key LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, modified DESC LIMIT ?`
      )
      .all(`%${key}%`, `${key}%`, limit) as Array<{ path: string; title: string }>
  }

  /** All tags with the number of notes. */
  tags(): Array<{ tag: string; count: number }> {
    return this.db
      .prepare('SELECT json_each.value AS tag, COUNT(*) AS count FROM notes, json_each(notes.tags) GROUP BY json_each.value ORDER BY json_each.value')
      .all() as Array<{ tag: string; count: number }>
  }

  /** Number of notes per folder (only the folder itself, not its sub folders). */
  folderCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const row of this.db.prepare('SELECT folder, COUNT(*) AS count FROM notes GROUP BY folder').all() as Array<{ folder: string; count: number }>) {
      counts[row.folder] = row.count
    }
    return counts
  }
}
