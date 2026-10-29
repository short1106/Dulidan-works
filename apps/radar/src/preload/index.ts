import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type RadarApi, type SendProgress } from '../shared/api'

// The only bridge between the window and the system. Small on purpose:
// every function does one named job, the window never gets ipcRenderer.

const invoke = (channel: string, ...args: unknown[]): Promise<never> => ipcRenderer.invoke(channel, ...args) as Promise<never>

const api: RadarApi = {
  appInfo: () => invoke(IPC.appInfo),
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (patch) => invoke(IPC.settingsUpdate, patch)
  },
  config: {
    get: () => invoke(IPC.configGet),
    update: (patch) => invoke(IPC.configUpdate, patch),
    saveSecrets: (secrets) => invoke(IPC.configSecrets, secrets)
  },
  smtp: { test: () => invoke(IPC.smtpTest) },
  search: { run: () => invoke(IPC.searchRun) },
  leads: {
    list: () => invoke(IPC.leadsList),
    update: (id, patch) => invoke(IPC.leadsUpdate, id, patch),
    remove: (id) => invoke(IPC.leadsRemove, id),
    checkWebsite: (id) => invoke(IPC.leadsCheckWebsite, id)
  },
  blocklist: {
    get: () => invoke(IPC.blocklistGet),
    set: (entries) => invoke(IPC.blocklistSet, entries)
  },
  templates: {
    list: () => invoke(IPC.templatesList),
    preview: (templateId, leadId) => invoke(IPC.templatesPreview, templateId, leadId)
  },
  send: {
    start: (leadIds, templateId) => invoke(IPC.sendStart, leadIds, templateId),
    stop: () => invoke(IPC.sendStop),
    status: () => invoke(IPC.sendStatus),
    onProgress: (listener) => {
      const handler = (_event: IpcRendererEvent, progress: SendProgress): void => listener(progress)
      ipcRenderer.on(IPC.sendProgress, handler)
      return () => ipcRenderer.removeListener(IPC.sendProgress, handler)
    }
  }
}

contextBridge.exposeInMainWorld('radar', api)
