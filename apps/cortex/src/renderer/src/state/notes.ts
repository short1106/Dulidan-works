import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'
import { notify } from '@dulidan/design-system'
import type { ErrorCode, FolderInfo, NoteSummary, SearchHit, TrashEntry } from '../../../shared/ipc'
import { can } from '../features'
import { t } from '../i18n'
import { currentMode } from './settings'

/**
 * What the list shows:
 *   all            every note (pinned first, then newest)
 *   pinned         only pinned notes
 *   folder         the notes of one folder ("" = top folder)
 *   tag            notes with one tag
 *   trash          the trash
 */
export type ListView = { kind: 'all' } | { kind: 'pinned' } | { kind: 'folder'; path: string } | { kind: 'tag'; tag: string } | { kind: 'trash' }

export interface NotesState {
  view: ListView
  query: string
  items: Array<NoteSummary | SearchHit>
  trash: TrashEntry[]
  folders: FolderInfo
  tags: Array<{ tag: string; count: number }>
  loading: boolean
}

export const notesStore = createStore<NotesState>({
  view: { kind: 'all' },
  query: '',
  items: [],
  trash: [],
  folders: { folders: [], counts: {} },
  tags: [],
  loading: true
})

export const useNotes = (): NotesState => useSyncExternalStore(notesStore.subscribe, notesStore.get)

export function errorText(code: ErrorCode | string): string {
  return t.errors[code] ?? t.errors['unknown']!
}

function filterOf(view: ListView): { folder?: string; tag?: string; pinnedOnly?: boolean } {
  if (view.kind === 'folder') return { folder: view.path }
  if (view.kind === 'tag') return { tag: view.tag }
  if (view.kind === 'pinned') return { pinnedOnly: true }
  return {}
}

let refreshCounter = 0

/** Reloads list, folders, tags and trash from the main process. */
export async function refreshLists(): Promise<void> {
  const run = ++refreshCounter
  const { view, query } = notesStore.get()
  const advanced = can('folders', currentMode())
  // In basic mode there are no folders or tags: always all notes.
  const effective: ListView = advanced || view.kind === 'trash' ? view : { kind: 'all' }
  const [items, trash, folders, tags] = await Promise.all([
    effective.kind === 'trash' ? Promise.resolve([]) : query.trim() ? window.cortex.notes.search(query, effective.kind === 'all' ? {} : filterOf(effective)) : window.cortex.notes.list(filterOf(effective)),
    window.cortex.trash.list(),
    advanced ? window.cortex.folders.list() : Promise.resolve({ folders: [], counts: {} }),
    advanced ? window.cortex.notes.tags() : Promise.resolve([])
  ])
  if (run !== refreshCounter) return
  notesStore.set((state) => ({ ...state, items, trash, folders, tags, loading: false }))
}

export function showView(view: ListView): void {
  notesStore.set((state) => ({ ...state, view, query: view.kind === 'trash' ? '' : state.query }))
  void refreshLists()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

/** Search while typing, with a short pause so fast typing stays smooth. */
export function setQuery(query: string): void {
  notesStore.set((state) => ({ ...state, query, view: state.view.kind === 'trash' ? { kind: 'all' } : state.view }))
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void refreshLists(), 120)
}

export function isSearchHit(item: NoteSummary | SearchHit): item is SearchHit {
  return 'snippet' in item
}

/** The folder new notes go into: the shown folder in expert mode, else the top folder. */
export function folderForNewNote(): string {
  const { view } = notesStore.get()
  return view.kind === 'folder' && can('folders', currentMode()) ? view.path : ''
}

export async function restoreFromTrash(entry: TrashEntry): Promise<void> {
  const result = await window.cortex.trash.restore(entry.path)
  if (!result.ok) return notify(errorText(result.error), 'error')
  notify(t.trash.restored(entry.title), 'success')
  await refreshLists()
}

export async function deleteForGood(entry: TrashEntry): Promise<void> {
  const result = await window.cortex.trash.deleteForGood(entry.path)
  if (!result.ok) return notify(errorText(result.error), 'error')
  notify(t.trash.deleted, 'success')
  await refreshLists()
}
