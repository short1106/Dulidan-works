import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type { RelayApi } from './api'

// The only bridge between the window and the system. Small on purpose:
// every function does one named job, the window never gets ipcRenderer.

function listen<T extends unknown[]>(channel: string, listener: (...args: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, ...args: unknown[]): void => listener(...(args as T))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

// The return types are checked by RelayApi; ipcRenderer itself only knows "any".
const invoke = (channel: string, ...args: unknown[]): Promise<never> => ipcRenderer.invoke(channel, ...args) as Promise<never>

const api: RelayApi = {
  appInfo: () => invoke(IPC.appInfo),
  settings: { get: () => invoke(IPC.settingsGet), update: (patch) => invoke(IPC.settingsUpdate, patch) },
  prefs: { get: () => invoke(IPC.prefsGet), update: (patch) => invoke(IPC.prefsUpdate, patch) },
  accounts: {
    list: () => invoke(IPC.accountsList),
    presets: () => invoke(IPC.accountsPresets),
    test: (input, password) => invoke(IPC.accountsTest, input, password),
    add: (input, password) => invoke(IPC.accountsAdd, input, password),
    update: (id, patch, password) => invoke(IPC.accountsUpdate, id, patch, password),
    remove: (id) => invoke(IPC.accountsRemove, id)
  },
  mail: {
    sync: (accountId, folder) => invoke(IPC.mailSync, accountId, folder),
    syncState: () => invoke(IPC.mailSyncState),
    folders: (accountId) => invoke(IPC.mailFolders, accountId),
    messages: (accountId, folder) => invoke(IPC.mailMessages, accountId, folder),
    allInboxes: () => invoke(IPC.mailMessages, null, null),
    message: (id) => invoke(IPC.mailMessage, id),
    setSeen: (id, seen) => invoke(IPC.mailSetSeen, id, seen),
    moveToTrash: (id) => invoke(IPC.mailTrash, id),
    search: (query) => invoke(IPC.mailSearch, query),
    saveAttachment: (id, index) => invoke(IPC.mailSaveAttachment, id, index),
    previewAttachment: (id, index) => invoke(IPC.mailPreviewAttachment, id, index),
    attachmentData: (id, index) => invoke(IPC.mailAttachmentData, id, index),
    importIcsAttachment: (id, index) => invoke(IPC.mailImportIcsAttachment, id, index),
    loadRemoteImages: (urls) => invoke(IPC.mailLoadRemoteImages, urls),
    openLink: (url) => invoke(IPC.mailOpenLink, url),
    send: (request) => invoke(IPC.mailSend, request),
    remainingToday: (accountId) => invoke(IPC.mailRemaining, accountId)
  },
  drafts: {
    list: () => invoke(IPC.draftsList),
    save: (draft) => invoke(IPC.draftsSave, draft),
    remove: (id) => invoke(IPC.draftsRemove, id)
  },
  calendar: {
    range: (fromUtc, toUtc) => invoke(IPC.calendarRange, fromUtc, toUtc),
    add: (input) => invoke(IPC.calendarAdd, input),
    update: (id, input) => invoke(IPC.calendarUpdate, id, input),
    remove: (id) => invoke(IPC.calendarRemove, id),
    importFile: () => invoke(IPC.calendarImportFile)
  },
  events: {
    onChanged: (listener) => listen(IPC.onChanged, listener),
    onSyncState: (listener) => listen(IPC.onSyncState, listener),
    onOpenMessage: (listener) => listen(IPC.onOpenMessage, listener)
  },
  window: {
    setDirty: (dirty) => ipcRenderer.send(IPC.windowSetDirty, dirty),
    onCloseRequested: (listener) => listen(IPC.windowCloseRequested, listener),
    confirmClose: () => ipcRenderer.send(IPC.windowConfirmClose)
  }
}

contextBridge.exposeInMainWorld('relay', api)
