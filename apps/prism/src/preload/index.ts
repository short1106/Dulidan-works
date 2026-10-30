import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PrismApi } from '../shared/api'

// The only bridge between the window and the system. Small on purpose.
const invoke = (channel: string, ...args: unknown[]): Promise<never> => ipcRenderer.invoke(channel, ...args) as Promise<never>

const api: PrismApi = {
  appInfo: () => invoke(IPC.appInfo),
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (patch) => invoke(IPC.settingsUpdate, patch)
  },
  file: {
    open: () => invoke(IPC.fileOpen),
    save: (deck, path) => invoke(IPC.fileSave, deck, path)
  },
  recovery: {
    save: (deck) => invoke(IPC.recoverySave, deck),
    load: () => invoke(IPC.recoveryLoad),
    discard: () => invoke(IPC.recoveryDiscard)
  },
  pdf: { export: (name) => invoke(IPC.pdfExport, name) }
}

contextBridge.exposeInMainWorld('prism', api)
