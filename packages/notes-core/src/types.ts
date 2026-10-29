/** Colors of the note cards ("Zettel"). Names are stored in the file. */
export const NOTE_COLORS = ['gelb', 'gruen', 'blau', 'rosa', 'lila', 'orange'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && (NOTE_COLORS as readonly string[]).includes(value)
}

/** The small header at the top of every note file. */
export interface NoteMeta {
  title: string
  tags: string[]
  /** ISO dates. */
  created: string
  modified: string
  pinned: boolean
  color: NoteColor | null
  /** Only in the trash: when the note was put there and where it came from. */
  deleted: string | null
  original: string | null
  /** Header lines Cortex does not know, kept unchanged (e.g. from other apps). */
  extra: string[]
}

export interface Note {
  meta: NoteMeta
  /** Markdown text below the header. */
  body: string
}

/** A note as shown in lists and cards (from the search index). */
export interface NoteSummary {
  /** Path inside the notes folder, with "/" separators, e.g. "Rezepte/Kuchen.md". */
  path: string
  folder: string
  title: string
  tags: string[]
  created: string
  modified: string
  pinned: boolean
  color: NoteColor | null
  excerpt: string
  tasksDone: number
  tasksTotal: number
  /** First image of the note (path inside the notes folder), for the cards. */
  image: string | null
}

export interface TrashEntry {
  /** Path inside the trash folder. */
  path: string
  title: string
  original: string
  deleted: string
  /** Days until the note may be deleted for good (0 = now). */
  daysLeft: number
}
