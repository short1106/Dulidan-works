import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'
import { ask, notify } from '@dulidan/design-system'
import { NOTE_COLORS, type NoteColor } from '@dulidan/notes-core'
import type { NoteSummary, OpenedNote, SyncResult } from '../../../shared/ipc'
import { can } from '../features'
import { t } from '../i18n'
import { errorText, folderForNewNote, notesStore, refreshLists } from './notes'
import { currentMode } from './settings'

/** Saving starts after this pause in typing. */
export const AUTOSAVE_DELAY_MS = 2000
/** The crash backup is written a bit sooner. */
const RECOVERY_DELAY_MS = 700

export interface NoteState {
  current: OpenedNote | null
  /** True from the first change until it is saved. */
  dirty: boolean
  saving: boolean
  savedAt: number | null
  /** Changes when the editor must start fresh (other note, reloaded text). */
  editorKey: number
  backlinks: NoteSummary[]
  /** Put the cursor into the title (new note). */
  focusTitle: boolean
}

export const noteStore = createStore<NoteState>({ current: null, dirty: false, saving: false, savedAt: null, editorKey: 0, backlinks: [], focusTitle: false })
export const useNote = (): NoteState => useSyncExternalStore(noteStore.subscribe, noteStore.get)

let getMarkdown: (() => string) | null = null
let getHtml: (() => string) | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let recoveryTimer: ReturnType<typeof setTimeout> | null = null
let saving: Promise<boolean> | null = null

/** The editor tells how to get its text (as Markdown for the file, as HTML for printing). */
export function registerEditor(getters: { markdown: () => string; html: () => string } | null): void {
  getMarkdown = getters?.markdown ?? null
  getHtml = getters?.html ?? null
}

/** The text of the open note as HTML (for the PDF). */
export function currentHtml(): string {
  return getHtml?.() ?? ''
}

function setDirty(dirty: boolean): void {
  noteStore.set((state) => ({ ...state, dirty }))
  window.cortex.window.setDirty(dirty)
}

/** Called by the editor on every change of the text. */
export function markChanged(): void {
  const { current } = noteStore.get()
  if (!current) return
  if (!noteStore.get().dirty) setDirty(true)
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS)
  if (recoveryTimer) clearTimeout(recoveryTimer)
  recoveryTimer = setTimeout(() => {
    const note = noteStore.get().current
    if (note && noteStore.get().dirty && getMarkdown) void window.cortex.recovery.put(note.path, note.meta.title, getMarkdown())
  }, RECOVERY_DELAY_MS)
}

/** Saves the open note now. Returns false if it could not be saved. */
export function saveNow(): Promise<boolean> {
  if (saving) return saving.then(() => (noteStore.get().dirty ? saveNow() : true))
  saving = doSave().finally(() => {
    saving = null
  })
  return saving
}

async function doSave(): Promise<boolean> {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  const { current, dirty } = noteStore.get()
  if (!current || !dirty || !getMarkdown) return true
  const body = getMarkdown()
  noteStore.set((state) => ({ ...state, saving: true }))
  const result = await window.cortex.notes.save(current.path, body, current.mtimeMs)
  noteStore.set((state) => ({ ...state, saving: false }))
  if (result.ok) {
    const stillSame = noteStore.get().current?.path === current.path
    noteStore.set((state) =>
      stillSame && state.current
        ? { ...state, current: { ...state.current, body, mtimeMs: result.value.mtimeMs, meta: { ...state.current.meta, modified: result.value.modified } }, savedAt: Date.now() }
        : state
    )
    // Text typed while saving stays "dirty" and is saved in the next round.
    if (stillSame && getMarkdown && getMarkdown() === body) setDirty(false)
    else if (stillSame) markChanged()
    void refreshLists()
    return true
  }
  if (result.error === 'conflict') return resolveConflict(current, body)
  if (result.error === 'not-found') return keepAsNewNote(current, body)
  notify(errorText(result.error), 'error')
  return false
}

/** The file changed outside Cortex while the user was typing here. */
async function resolveConflict(note: OpenedNote, body: string): Promise<boolean> {
  const answer = await ask({
    title: t.note.conflictTitle,
    text: t.note.conflictText,
    cancelValue: 'mine',
    choices: [
      { value: 'theirs', label: t.note.loadTheirs, variant: 'secondary' },
      { value: 'mine', label: t.note.keepMine, variant: 'primary' }
    ]
  })
  const fresh = await window.cortex.notes.load(note.path)
  if (!fresh.ok) return keepAsNewNote(note, body)
  if (answer === 'theirs') {
    setDirty(false)
    void window.cortex.recovery.drop(note.path)
    showNote(fresh.value)
    return true
  }
  noteStore.set((state) => (state.current?.path === note.path ? { ...state, current: { ...state.current, mtimeMs: fresh.value.mtimeMs } } : state))
  // Already inside a save: save again directly, not through the queue (that would wait for itself).
  return doSave()
}

async function keepAsNewNote(note: OpenedNote, body: string): Promise<boolean> {
  const answer = await ask({
    title: t.note.removedTitle,
    text: t.note.removedText,
    cancelValue: 'keep',
    choices: [
      { value: 'discard', label: t.note.discard, variant: 'ghost' },
      { value: 'keep', label: t.note.keepAsNew, variant: 'primary' }
    ]
  })
  setDirty(false)
  void window.cortex.recovery.drop(note.path)
  if (answer === 'discard') {
    noteStore.set((state) => ({ ...state, current: null }))
    void refreshLists()
    return true
  }
  const created = await window.cortex.notes.create({ title: note.meta.title, body, color: note.meta.color })
  if (!created.ok) {
    notify(errorText(created.error), 'error')
    return false
  }
  showNote(created.value)
  void refreshLists()
  return true
}

/** Saves what is pending (before switching notes or closing). */
export async function flush(): Promise<boolean> {
  if (!noteStore.get().dirty) return true
  return saveNow()
}

function showNote(note: OpenedNote, focusTitle = false): void {
  noteStore.set((state) => ({ ...state, current: note, dirty: false, saving: false, savedAt: null, editorKey: state.editorKey + 1, backlinks: [], focusTitle }))
  window.cortex.window.setDirty(false)
  void loadBacklinks()
}

export async function loadBacklinks(): Promise<void> {
  const note = noteStore.get().current
  if (!note || !can('backlinks', currentMode())) return
  const backlinks = await window.cortex.notes.backlinks(note.path)
  noteStore.set((state) => (state.current?.path === note.path ? { ...state, backlinks } : state))
}

export async function openNote(path: string): Promise<void> {
  if (noteStore.get().current?.path === path) return
  if (!(await flush())) return
  const result = await window.cortex.notes.load(path)
  if (!result.ok) {
    notify(errorText(result.error), 'error')
    void refreshLists()
    return
  }
  showNote(result.value)
}

/** Closes the note (basic mode: back to the cards). */
export async function closeNote(): Promise<void> {
  if (!(await flush())) return
  noteStore.set((state) => ({ ...state, current: null, backlinks: [] }))
}

export async function createNote(title?: string): Promise<void> {
  if (!(await flush())) return
  // In basic mode every new note gets the next card color.
  const count = notesStore.get().items.length
  const color: NoteColor | null = currentMode() === 'basic' ? NOTE_COLORS[count % NOTE_COLORS.length]! : null
  const result = await window.cortex.notes.create({ folder: folderForNewNote(), title, color })
  if (!result.ok) return notify(errorText(result.error), 'error')
  showNote(result.value, !title)
  await refreshLists()
}

export async function renameCurrent(title: string): Promise<void> {
  const note = noteStore.get().current
  const clean = title.trim()
  if (!note || !clean || clean === note.meta.title) return
  if (!(await flush())) return
  const result = await window.cortex.notes.rename(note.path, clean)
  if (!result.ok) return notify(errorText(result.error), 'error')
  void window.cortex.recovery.drop(note.path)
  const { updatedLinks, ...renamed } = result.value
  // Keep the newest text of the editor; only path, title and file time change.
  noteStore.set((state) => ({
    ...state,
    focusTitle: false,
    current: state.current?.path === note.path ? { ...state.current, path: renamed.path, meta: renamed.meta, mtimeMs: renamed.mtimeMs } : state.current
  }))
  if (updatedLinks > 0) notify(t.note.renamedLinks(updatedLinks), 'info')
  await refreshLists()
}

async function changeMeta(work: (path: string) => Promise<{ ok: true; value: { mtimeMs: number } } | { ok: false; error: string }>, patch: Partial<OpenedNote['meta']>): Promise<void> {
  const note = noteStore.get().current
  if (!note || !(await flush())) return
  const result = await work(note.path)
  if (!result.ok) return notify(errorText(result.error), 'error')
  noteStore.set((state) =>
    state.current?.path === note.path ? { ...state, current: { ...state.current, mtimeMs: result.value.mtimeMs, meta: { ...state.current.meta, ...patch } } } : state
  )
  await refreshLists()
}

export const setPinned = (pinned: boolean): Promise<void> => changeMeta((path) => window.cortex.notes.pin(path, pinned), { pinned })
export const setColor = (color: NoteColor | null): Promise<void> => changeMeta((path) => window.cortex.notes.color(path, color), { color })
export const setTags = (tags: string[]): Promise<void> => changeMeta((path) => window.cortex.notes.setTags(path, tags), { tags })

export async function trashCurrent(): Promise<void> {
  const note = noteStore.get().current
  if (!note) return
  // Pending text is saved first, so the trash holds the newest version.
  if (!(await flush())) return
  const result = await window.cortex.notes.trash(note.path)
  if (!result.ok) return notify(errorText(result.error), 'error')
  noteStore.set((state) => ({ ...state, current: null, backlinks: [] }))
  window.cortex.window.setDirty(false)
  notify(t.note.trashed(note.meta.title), 'success')
  await refreshLists()
}

export async function moveCurrent(folder: string): Promise<void> {
  const note = noteStore.get().current
  if (!note || !(await flush())) return
  const result = await window.cortex.notes.move(note.path, folder)
  if (!result.ok) return notify(errorText(result.error), 'error')
  const reloaded = await window.cortex.notes.load(result.value)
  if (reloaded.ok) showNote(reloaded.value)
  notify(t.note.moved(folder || t.nav.topLevel), 'success')
  await refreshLists()
}

/** Files changed outside Cortex: update the lists and, if needed, the open note. */
export async function handleOutsideChange(result: SyncResult): Promise<void> {
  await refreshLists()
  const note = noteStore.get().current
  if (!note) return
  if (result.changed.includes(note.path)) {
    const fresh = await window.cortex.notes.load(note.path)
    if (!fresh.ok || Math.abs(fresh.value.mtimeMs - note.mtimeMs) <= 1) return
    // Unchanged here: just show the new text. Changed here too: the next save asks.
    if (!noteStore.get().dirty) showNote(fresh.value)
  } else if (result.removed.includes(note.path) && !noteStore.get().dirty) {
    noteStore.set((state) => ({ ...state, current: null, backlinks: [] }))
  }
  void loadBacklinks()
}
