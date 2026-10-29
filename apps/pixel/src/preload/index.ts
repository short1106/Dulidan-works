import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type { PixelApi } from './api'

// The only bridge between the window and the system. Small on purpose:
// every function does one named job, the window never gets ipcRenderer.

function listen<T extends unknown[]>(channel: string, listener: (...args: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, ...args: unknown[]): void => listener(...(args as T))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: PixelApi = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  prefs: {
    get: () => ipcRenderer.invoke(IPC.prefsGet),
    update: (patch) => ipcRenderer.invoke(IPC.prefsUpdate, patch)
  },
  file: {
    openDialog: () => ipcRenderer.invoke(IPC.fileOpenDialog),
    openPath: (filePath) => ipcRenderer.invoke(IPC.fileOpenPath, filePath),
    saveProject: (request) => ipcRenderer.invoke(IPC.fileSaveProject, request),
    exportImage: (request) => ipcRenderer.invoke(IPC.fileExportImage, request),
    takeLaunchFile: () => ipcRenderer.invoke(IPC.fileTakeLaunchFile),
    onOpenRequested: (listener) => listen(IPC.fileOpenRequested, listener),
    showInFolder: (filePath) => ipcRenderer.invoke(IPC.fileShowInFolder, filePath)
  },
  recovery: {
    check: () => ipcRenderer.invoke(IPC.recoveryCheck),
    snapshot: (request) => ipcRenderer.invoke(IPC.recoverySnapshot, request),
    markSaved: (docId, title, filePath) => ipcRenderer.invoke(IPC.recoveryMarkSaved, docId, title, filePath),
    load: (docId) => ipcRenderer.invoke(IPC.recoveryLoad, docId),
    discard: (docId) => ipcRenderer.invoke(IPC.recoveryDiscard, docId)
  },
  window: {
    setDirty: (dirty) => ipcRenderer.send(IPC.windowSetDirty, dirty),
    onCloseRequested: (listener) => listen(IPC.windowCloseRequested, listener),
    confirmClose: () => ipcRenderer.send(IPC.windowConfirmClose)
  }
}

contextBridge.exposeInMainWorld('pixel', api)
