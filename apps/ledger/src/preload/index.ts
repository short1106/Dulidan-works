import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type LedgerApi } from '../shared/api'

// The only bridge between the window and the system. Small on purpose.
const invoke = (channel: string, ...args: unknown[]): Promise<never> => ipcRenderer.invoke(channel, ...args) as Promise<never>

const api: LedgerApi = {
  appInfo: () => invoke(IPC.appInfo),
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (patch) => invoke(IPC.settingsUpdate, patch)
  },
  data: { get: () => invoke(IPC.dataGet) },
  company: { save: (company) => invoke(IPC.companySave, company) },
  customers: {
    save: (customer) => invoke(IPC.customerSave, customer),
    remove: (id) => invoke(IPC.customerRemove, id)
  },
  documents: {
    create: (kind, customerId) => invoke(IPC.documentCreate, kind, customerId),
    update: (id, patch) => invoke(IPC.documentUpdate, id, patch),
    remove: (id) => invoke(IPC.documentRemove, id),
    issue: (id) => invoke(IPC.documentIssue, id),
    cancel: (id) => invoke(IPC.documentCancel, id),
    toInvoice: (id) => invoke(IPC.documentToInvoice, id)
  },
  pdf: { export: (name) => invoke(IPC.pdfExport, name) }
}

contextBridge.exposeInMainWorld('ledger', api)
