import { useSyncExternalStore } from 'react'
import { ask, notify } from '@dulidan/design-system'
import { createStore } from '@dulidan/core'
import { canvasToBytes, flatten } from '../engine/compose'
import { createDocument, docStore, getDoc, replaceDocument, type Background } from '../engine/document'
import { documentToProject, imageToDocument, projectToDocument } from '../engine/io'
import { t } from '../i18n'
import type { FileLocation, OpenResult, SaveResult } from '../../../shared/ipc'
import { currentMode } from './settings'
import { fitToView } from './viewport'

/**
 * The open picture as a file: name, place, unsaved changes, autosave.
 * Toolbars, menus and shortcuts all call these functions.
 */
export interface Session {
  /** Id for autosave snapshots, new for every opened picture. */
  docId: string
  location: FileLocation | null
  /** Name for a picture that came from a PNG or JPG and was not saved yet. */
  importedName: string | null
  createdAt: string
  dirty: boolean
}

function newSession(location: FileLocation | null = null, importedName: string | null = null): Session {
  return { docId: crypto.randomUUID(), location, importedName, createdAt: new Date().toISOString(), dirty: false }
}

export const sessionStore = createStore<Session>(newSession())

export function useSession(): Session {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
}

/** Basic mode: "Gespeichert in Bilder" dialog after saving. */
export interface SavedInfo {
  name: string
  folder: string
  filePath: string
}
export const savedInfoStore = createStore<SavedInfo | null>(null)

/** Document version when the file was last saved and when the last snapshot was written. */
let savedVersion = 0
let snapshotVersion = 0

// Every change of the picture makes the file "dirty".
docStore.subscribe(() => {
  const dirty = docStore.get().version !== savedVersion
  if (sessionStore.get().dirty !== dirty) sessionStore.set((session) => ({ ...session, dirty }))
})

export function sessionTitle(session = sessionStore.get()): string {
  return session.location?.fileName ?? session.importedName ?? t.app.untitled
}

export function folderLabel(location: FileLocation): string {
  return location.folderKind === 'other' ? location.folderName : t.folders[location.folderKind]
}

function markClean(): void {
  savedVersion = docStore.get().version
  sessionStore.set((session) => ({ ...session, dirty: false }))
}

/** Shows a freshly loaded picture and starts a new session for it. */
function showDocument(session: Session, keepDirty = false): void {
  const previous = sessionStore.get()
  if (!previous.dirty) void window.pixel.recovery.discard(previous.docId)
  sessionStore.set(session)
  savedVersion = keepDirty ? -1 : docStore.get().version
  snapshotVersion = docStore.get().version
  sessionStore.set((current) => ({ ...current, dirty: keepDirty }))
  const doc = getDoc()
  // Wait a frame so the viewport knows its size.
  requestAnimationFrame(() => fitToView(doc.width, doc.height))
}

/** Before the picture is replaced or closed: ask to save if needed. */
export async function confirmLeave(): Promise<boolean> {
  const session = sessionStore.get()
  if (!session.dirty) return true
  const answer = await ask({
    title: t.dialogs.unsavedTitle,
    text: t.dialogs.unsavedText(sessionTitle(session)),
    cancelValue: 'cancel',
    choices: [
      { value: 'cancel', label: t.dialogs.cancel, variant: 'ghost' },
      { value: 'discard', label: t.dialogs.dontSave, variant: 'secondary' },
      { value: 'save', label: t.dialogs.save, variant: 'primary' }
    ]
  })
  if (answer === 'cancel') return false
  if (answer === 'save') return saveProject()
  await window.pixel.recovery.discard(session.docId)
  return true
}

/** Starts with a fresh picture (no question, used at app start). */
export function startBlank(width = 1920, height = 1080): void {
  replaceDocument(createDocument(width, height, { kind: 'color', color: '#ffffff' }, t.layers.background))
  showDocument(newSession())
}

export async function newPicture(width: number, height: number, background: Background): Promise<boolean> {
  if (!(await confirmLeave())) return false
  replaceDocument(createDocument(width, height, background, t.layers.background))
  showDocument(newSession())
  return true
}

/** Puts an opened project or image on the canvas. */
export async function showOpened(result: OpenResult, options: { keepDirty?: boolean; docId?: string } = {}): Promise<boolean> {
  if (!result.ok) {
    if ('error' in result) notify(t.errors[result.error], 'error')
    return false
  }
  const opened = result.opened
  try {
    if (opened.kind === 'project') {
      replaceDocument(await projectToDocument(opened.project))
      const session = newSession(opened.location)
      showDocument({ ...session, docId: options.docId ?? session.docId, createdAt: opened.project.createdAt }, options.keepDirty)
    } else {
      replaceDocument(await imageToDocument(opened.bytes, opened.mime, t.layers.background))
      showDocument(newSession(null, opened.name))
    }
    return true
  } catch {
    notify(t.errors.imageFailed, 'error')
    return false
  }
}

export async function openWithDialog(): Promise<void> {
  if (!(await confirmLeave())) return
  await showOpened(await window.pixel.file.openDialog())
}

export async function openRecent(filePath: string): Promise<void> {
  if (!(await confirmLeave())) return
  await showOpened(await window.pixel.file.openPath(filePath))
}

/** Saves the project as .pixel. Returns true if it was saved. */
export async function saveProject(saveAs = false): Promise<boolean> {
  const session = sessionStore.get()
  const version = docStore.get().version
  const project = await documentToProject(getDoc(), session.createdAt)
  const result: SaveResult = await window.pixel.file.saveProject({
    project,
    filePath: session.location?.filePath ?? null,
    saveAs,
    suggestedName: sessionTitle(session)
  })
  if (!result.ok) {
    if ('error' in result) notify(t.errors[result.error], 'error')
    return false
  }
  sessionStore.set((current) => ({ ...current, location: result.location, importedName: null }))
  // Only clean if nothing was painted while the file was written.
  if (docStore.get().version === version) markClean()
  void window.pixel.recovery.markSaved(session.docId, result.location.fileName, result.location.filePath)
  showSavedMessage(result.location, !session.location || saveAs)
  return true
}

function showSavedMessage(location: FileLocation, firstTime: boolean): void {
  if (currentMode() === 'basic' && firstTime) {
    savedInfoStore.set({ name: location.fileName, folder: folderLabel(location), filePath: location.filePath })
  } else {
    notify(t.notices.saved, 'success')
  }
}

/** "Als Bild speichern": PNG keeps transparency, JPG gets a white background. */
export async function exportImage(format: 'png' | 'jpg'): Promise<void> {
  try {
    const canvas = flatten(getDoc(), format === 'jpg' ? '#ffffff' : undefined)
    const bytes = await canvasToBytes(canvas, format === 'png' ? 'image/png' : 'image/jpeg', 0.92)
    const result = await window.pixel.file.exportImage({ format, bytes, suggestedName: sessionTitle() })
    if (!result.ok) {
      if ('error' in result) notify(t.errors[result.error], 'error')
      return
    }
    if (currentMode() === 'basic') {
      savedInfoStore.set({ name: result.location.fileName, folder: folderLabel(result.location), filePath: result.location.filePath })
    } else {
      notify(t.notices.exported, 'success')
    }
  } catch {
    notify(t.errors.exportFailed, 'error')
  }
}

/** Autosave: writes a snapshot if the picture changed since the last one. */
export async function snapshotIfChanged(): Promise<void> {
  const version = docStore.get().version
  if (version === snapshotVersion) return
  snapshotVersion = version
  const session = sessionStore.get()
  try {
    await window.pixel.recovery.snapshot({
      docId: session.docId,
      project: await documentToProject(getDoc(), session.createdAt),
      title: sessionTitle(session),
      filePath: session.location?.filePath ?? null,
      unsaved: session.dirty
    })
  } catch (error) {
    // Autosave must never disturb painting; try again next time.
    console.error('Autosave failed', error)
    snapshotVersion = -1
  }
}

export async function handleCloseRequest(): Promise<void> {
  if (await confirmLeave()) {
    sessionStore.set((session) => ({ ...session, dirty: false }))
    window.pixel.window.confirmClose()
  }
}

/** Basic mode "Als Bild speichern": asks PNG or JPG in plain words, then saves. */
export async function saveAsImage(): Promise<void> {
  const format = await ask({
    title: t.dialogs.imageFormatTitle,
    text: t.dialogs.imageFormatText,
    cancelValue: 'cancel',
    choices: [
      { value: 'cancel', label: t.dialogs.cancel, variant: 'ghost' },
      { value: 'jpg', label: 'JPG', variant: 'secondary' },
      { value: 'png', label: 'PNG', variant: 'primary' }
    ]
  })
  if (format !== 'cancel') await exportImage(format)
}
