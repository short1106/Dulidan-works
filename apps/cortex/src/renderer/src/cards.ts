import { NOTE_COLORS, type NoteColor } from '@dulidan/notes-core'
import type { NoteSummary } from '../../shared/ipc'

/** A fixed color for notes without one (e.g. files from other programs), taken from the file name. */
export function cardColor(item: Pick<NoteSummary, 'color' | 'path'>): NoteColor {
  if (item.color) return item.color
  let hash = 0
  for (const char of item.path) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return NOTE_COLORS[hash % NOTE_COLORS.length]!
}

