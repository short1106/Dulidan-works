import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type { GlyphApi } from './api'

// The preload script is the only bridge between the window and the system.
// It stays deliberately small: every function does exactly one named job and
// the window never gets ipcRenderer itself.

function listen<T extends unknown[]>(channel: string, listener: (...args: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, ...args: unknown[]): void => listener(...(args as T))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: GlyphApi = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),

  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch),
    onChange: (listener) => listen(IPC.settingsChanged, listener)
  },

  file: {
    openDialog: () => ipcRenderer.invoke(IPC.fileOpenDialog),
    openPath: (filePath) => ipcRenderer.invoke(IPC.fileOpenPath, filePath),
    save: (request) => ipcRenderer.invoke(IPC.fileSave, request),
    takeLaunchFile: () => ipcRenderer.invoke(IPC.fileTakeLaunchFile),
    onOpenRequested: (listener) => listen(IPC.fileOpenRequested, listener),
    showInFolder: (filePath) => ipcRenderer.invoke(IPC.fileShowInFolder, filePath)
  },

  recovery: {
    check: () => ipcRenderer.invoke(IPC.recoveryCheck),
    snapshot: (request) => ipcRenderer.invoke(IPC.recoverySnapshot, request),
    markSaved: (docId, title, filePath) => ipcRenderer.invoke(IPC.recoveryMarkSaved, docId, title, filePath),
    list: (docId) => ipcRenderer.invoke(IPC.recoveryList, docId),
    load: (docId, snapshotId) => ipcRenderer.invoke(IPC.recoveryLoad, docId, snapshotId),
    discard: (docId) => ipcRenderer.invoke(IPC.recoveryDiscard, docId)
  },

  print: {
    exportPdf: (suggestedName) => ipcRenderer.invoke(IPC.exportPdf, suggestedName),
    print: () => ipcRenderer.invoke(IPC.print)
  },

  window: {
    setDirty: (dirty) => ipcRenderer.send(IPC.windowSetDirty, dirty),
    onCloseRequested: (listener) => listen(IPC.windowCloseRequested, listener),
    confirmClose: () => ipcRenderer.send(IPC.windowConfirmClose)
  }
}

contextBridge.exposeInMainWorld('glyph', api)
