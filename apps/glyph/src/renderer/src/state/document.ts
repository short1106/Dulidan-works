import { useSyncExternalStore } from 'react'
import type { Editor, JSONContent } from '@tiptap/core'
import { EditorState } from '@tiptap/pm/state'
import { createEmptyDocument, createStore, type GlyphDocument } from '@dulidan/core'
import type { FileLocation, OpenResult, SaveResult } from '../../../shared/ipc'
import { t } from '../i18n'
import { ask } from './ask'
import { notify } from './notices'
import { settingsStore } from './settings'

/**
 * The open document and everything you can do with it: new, open, save,
 * PDF, print, autosave and recovery. Toolbar, menus and shortcuts all call
 * these functions, so each action behaves the same everywhere.
 */

export interface DocumentSession {
  /** Id for autosave snapshots. New for every opened document. */
  docId: string
  location: FileLocation | null
  createdAt: string
  dirty: boolean
  /** Counts edits, so autosave knows if anything changed. */
  revision: number
}

function newSession(location: FileLocation | null = null, createdAt = new Date().toISOString()): DocumentSession {
  return { docId: crypto.randomUUID(), location, createdAt, dirty: false, revision: 0 }
}

export const sessionStore = createStore<DocumentSession>(newSession())

export function useSession(): DocumentSession {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
}

/** Shown in basic mode after saving: "Gespeichert in Dokumente". */
export interface SavedInfo {
  kind: 'glyph' | 'pdf'
  name: string
  folder: string
  filePath: string
}
export const savedInfoStore = createStore<SavedInfo | null>(null)

/** Changes when a save succeeds, so the status bar can pulse its check mark. */
export const savePulseStore = createStore(0)

let editor: Editor | null = null
let lastSnapshotRevision = 0

export function attachEditor(instance: Editor | null): void {
  editor = instance
}

export function documentTitle(session = sessionStore.get()): string {
  return session.location?.fileName ?? t.app.untitled
}

export function folderLabel(location: FileLocation): string {
  if (location.folderKind === 'other') return location.folderName
  return t.folders[location.folderKind]
}

/** Called by the editor on every change. */
export function markChanged(): void {
  sessionStore.set((session) => ({ ...session, dirty: true, revision: session.revision + 1 }))
}

function currentDocument(): GlyphDocument {
  const session = sessionStore.get()
  return {
    content: (editor?.getJSON() ?? createEmptyDocument().content) as GlyphDocument['content'],
    createdAt: session.createdAt,
    modifiedAt: new Date().toISOString()
  }
}

/** Puts a document into the editor with a fresh undo history. */
function loadIntoEditor(content: JSONContent): void {
  if (!editor) return
  editor.commands.setContent(content, { emitUpdate: false })
  const state = editor.state
  editor.view.updateState(EditorState.create({ doc: state.doc, plugins: state.plugins }))
  editor.commands.focus('start')
}

function isBasicMode(): boolean {
  return (settingsStore.get().mode ?? 'basic') === 'basic'
}

function showOpenError(result: OpenResult): void {
  if (!result.ok && 'error' in result) notify(t.errors[result.error], 'error')
}

/**
 * Before the current document is replaced or closed: ask to save if needed.
 * Returns true if it is fine to go on.
 */
export async function confirmLeave(): Promise<boolean> {
  const session = sessionStore.get()
  if (!session.dirty) return true
  const answer = await ask({
    title: t.dialogs.unsavedTitle,
    text: t.dialogs.unsavedText(documentTitle(session)),
    cancelValue: 'cancel',
    choices: [
      { value: 'cancel', label: t.dialogs.cancel, variant: 'ghost' },
      { value: 'discard', label: t.dialogs.dontSave, variant: 'secondary' },
      { value: 'save', label: t.dialogs.save, variant: 'primary' }
    ]
  })
  if (answer === 'cancel') return false
  if (answer === 'save') return save()
  await window.glyph.recovery.discard(session.docId)
  return true
}

/** Replaces the editor content with an opened document. */
export function showOpenedDocument(result: OpenResult, options: { keepDirty?: boolean; docId?: string } = {}): boolean {
  if (!result.ok) {
    showOpenError(result)
    return false
  }
  const { location, document } = result.opened
  const previous = sessionStore.get()
  // Old snapshots of the replaced document are no longer needed, unless unsaved.
  if (!previous.dirty) void window.glyph.recovery.discard(previous.docId)
  loadIntoEditor(document.content as JSONContent)
  const session = newSession(location, document.createdAt)
  sessionStore.set({ ...session, docId: options.docId ?? session.docId, dirty: options.keepDirty ?? false })
  lastSnapshotRevision = 0
  return true
}

export async function newDocument(): Promise<void> {
  if (!(await confirmLeave())) return
  const previous = sessionStore.get()
  void window.glyph.recovery.discard(previous.docId)
  loadIntoEditor(createEmptyDocument().content as JSONContent)
  sessionStore.set(newSession())
  lastSnapshotRevision = 0
}

export async function openWithDialog(): Promise<void> {
  if (!(await confirmLeave())) return
  showOpenedDocument(await window.glyph.file.openDialog())
}

export async function openRecent(filePath: string): Promise<void> {
  if (!(await confirmLeave())) return
  showOpenedDocument(await window.glyph.file.openPath(filePath))
}

/** Saves the document. Returns true if it was saved. */
export async function save(saveAs = false): Promise<boolean> {
  const session = sessionStore.get()
  const result: SaveResult = await window.glyph.file.save({
    document: currentDocument(),
    filePath: session.location?.filePath ?? null,
    saveAs,
    suggestedName: documentTitle(session) === t.app.untitled ? firstWords() : documentTitle(session)
  })
  if (!result.ok) {
    if ('error' in result) notify(t.errors[result.error], 'error')
    return false
  }
  // Only clear "dirty" if nothing was typed while the file was written.
  sessionStore.set((current) => ({
    ...current,
    location: result.location,
    dirty: current.revision === session.revision ? false : current.dirty
  }))
  void window.glyph.recovery.markSaved(session.docId, result.location.fileName, result.location.filePath)
  savePulseStore.set((value) => value + 1)

  const isFirstSave = !session.location || saveAs
  if (isBasicMode() && isFirstSave) {
    savedInfoStore.set({
      kind: 'glyph',
      name: result.location.fileName,
      folder: folderLabel(result.location),
      filePath: result.location.filePath
    })
  } else {
    notify(t.notices.saved, 'success')
  }
  return true
}

/** A file name proposal from the first words of the text. */
function firstWords(): string {
  const text = editor?.getText().trim() ?? ''
  const words = text.split(/\s+/).slice(0, 5).join(' ')
  return words.replace(/[<>:"/\\|?*.]/g, '').slice(0, 60) || t.app.untitled
}

export async function exportPdf(): Promise<void> {
  const result = await window.glyph.print.exportPdf(documentTitle() === t.app.untitled ? firstWords() : documentTitle())
  if (result.canceled) return
  if (!result.ok || !result.location) {
    notify(t.errors.pdfFailed, 'error')
    return
  }
  if (isBasicMode()) {
    savedInfoStore.set({
      kind: 'pdf',
      name: result.location.fileName,
      folder: folderLabel(result.location),
      filePath: result.location.filePath
    })
  } else {
    notify(t.notices.pdfSaved, 'success')
  }
}

export async function printDocument(): Promise<void> {
  const result = await window.glyph.print.print()
  if (!result.ok && !result.canceled) notify(t.errors.printFailed, 'error')
}

/** Autosave: writes a snapshot if something changed since the last one. */
export async function snapshotIfChanged(): Promise<void> {
  const session = sessionStore.get()
  if (!editor || session.revision === lastSnapshotRevision) return
  lastSnapshotRevision = session.revision
  try {
    await window.glyph.recovery.snapshot({
      docId: session.docId,
      document: currentDocument(),
      title: documentTitle(session),
      filePath: session.location?.filePath ?? null,
      unsaved: session.dirty
    })
  } catch (error) {
    // Autosave must never disturb writing; try again next time.
    console.error('Autosave failed', error)
    lastSnapshotRevision = -1
  }
}

/** Loads an earlier snapshot of this document. Can be undone. */
export async function restoreSnapshot(snapshotId: string): Promise<boolean> {
  const session = sessionStore.get()
  const result = await window.glyph.recovery.load(session.docId, snapshotId)
  if (!result.ok) {
    showOpenError(result)
    return false
  }
  // Through a normal edit, so "Rückgängig" brings the newer text back.
  editor?.commands.setContent(result.opened.document.content as JSONContent, { emitUpdate: true })
  notify(t.versions.restored, 'success')
  return true
}

/** The window wants to close while there are unsaved changes. */
export async function handleCloseRequest(): Promise<void> {
  if (await confirmLeave()) {
    sessionStore.set((session) => ({ ...session, dirty: false }))
    window.glyph.window.confirmClose()
  }
}
