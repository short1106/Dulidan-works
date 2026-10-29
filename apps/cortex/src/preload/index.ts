import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { CortexApi } from './api'

/**
 * The narrow bridge: the window can only call these functions, nothing
 * else of Node or Electron.
 */
const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => ipcRenderer.invoke(channel, ...args) as Promise<T>

function listen(channel: string, callback: (...args: never[]) => void): () => void {
  const handler = (_event: unknown, ...args: unknown[]): void => (callback as (...a: unknown[]) => void)(...args)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: CortexApi = {
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (patch) => invoke(IPC.settingsUpdate, patch)
  },
  prefs: {
    get: () => invoke(IPC.prefsGet),
    update: (patch) => invoke(IPC.prefsUpdate, patch)
  },
  app: { info: () => invoke(IPC.appInfo) },
  vault: {
    info: () => invoke(IPC.vaultInfo),
    choose: () => invoke(IPC.vaultChoose),
    openInExplorer: () => invoke(IPC.vaultOpenInExplorer),
    rebuildIndex: () => invoke(IPC.rebuildIndex)
  },
  notes: {
    list: (filter) => invoke(IPC.notesList, filter),
    search: (query, filter) => invoke(IPC.notesSearch, query, filter),
    load: (path) => invoke(IPC.noteLoad, path),
    create: (input) => invoke(IPC.noteCreate, input),
    save: (path, body, expectedMtime) => invoke(IPC.noteSave, path, body, expectedMtime),
    rename: (path, title) => invoke(IPC.noteRename, path, title),
    move: (path, folder) => invoke(IPC.noteMove, path, folder),
    pin: (path, pinned) => invoke(IPC.notePin, path, pinned),
    color: (path, color) => invoke(IPC.noteColor, path, color),
    setTags: (path, tags) => invoke(IPC.noteTags, path, tags),
    trash: (path) => invoke(IPC.noteTrash, path),
    backlinks: (path) => invoke(IPC.backlinks, path),
    resolveLink: (title) => invoke(IPC.resolveLink, title),
    suggest: (text) => invoke(IPC.suggest, text),
    tags: () => invoke(IPC.tags)
  },
  folders: {
    list: () => invoke(IPC.folders),
    create: (parent, name) => invoke(IPC.folderCreate, parent, name),
    rename: (path, name) => invoke(IPC.folderRename, path, name),
    remove: (path) => invoke(IPC.folderRemove, path)
  },
  trash: {
    list: () => invoke(IPC.trashList),
    restore: (path) => invoke(IPC.trashRestore, path),
    deleteForGood: (path) => invoke(IPC.trashDelete, path),
    load: (path) => invoke(IPC.trashLoad, path)
  },
  attachments: {
    save: (bytes, name) => invoke(IPC.attachmentSave, bytes, name),
    open: (name) => invoke(IPC.attachmentOpen, name)
  },
  openLink: (url) => invoke(IPC.openLink, url),
  exports: {
    pdf: (title) => invoke(IPC.exportPdf, title),
    markdown: (path) => invoke(IPC.exportMarkdown, path),
    importFiles: (folder) => invoke(IPC.importFiles, folder)
  },
  recovery: {
    put: (path, title, body) => invoke(IPC.recoveryPut, path, title, body),
    drop: (path) => invoke(IPC.recoveryDrop, path),
    list: () => invoke(IPC.recoveryList),
    discard: (id) => invoke(IPC.recoveryDiscard, id)
  },
  quickNote: {
    save: (title, body) => invoke(IPC.quickNoteSave, title, body),
    close: () => invoke(IPC.quickNoteClose)
  },
  window: {
    setDirty: (dirty) => ipcRenderer.send(IPC.windowSetDirty, dirty),
    closeConfirmed: () => ipcRenderer.send(IPC.windowCloseConfirmed)
  },
  events: {
    onNotesChanged: (callback) => listen(IPC.onNotesChanged, callback),
    onVaultChanged: (callback) => listen(IPC.onVaultChanged, callback),
    onCloseRequested: (callback) => listen(IPC.onCloseRequested, callback),
    onOpenNote: (callback) => listen(IPC.onOpenNote, callback)
  }
}

contextBridge.exposeInMainWorld('cortex', api)
