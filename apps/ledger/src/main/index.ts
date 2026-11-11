import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { normalizeSettings, type Settings } from '@dulidan/core'
import { JsonFile, atomicWriteFile } from '@dulidan/core/node'
import { renderPdf, startAutoUpdate } from '@dulidan/core/electron'
import { IPC, type LedgerData } from '../shared/api'
import { datevBookings, datevCsv, encodeWindows1252 } from './datev'
import type { CompanyData, Item } from './logic'
import type { Payment } from './payments'
import { DocumentError, LedgerStore, type BillingSettings, type Customer, type DocumentKind } from './store'

// Tests and the "wie neu" start use their own folder, so real data stays untouched.
if (process.env['LEDGER_USER_DATA']) app.setPath('userData', process.env['LEDGER_USER_DATA'])

const devServerUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined

let store: LedgerStore
let settingsFile: JsonFile<Settings>

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Dulidan Ledger',
    show: false,
    backgroundColor: '#0b0614',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  window.on('ready-to-show', () => window.show())
  if (devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return window
}

function snapshotForWindow(): LedgerData {
  const data = store.data()
  return { company: data.company, customers: data.customers, documents: data.documents, billing: data.billing }
}

/** Runs an action and turns a business error into a plain message for the window. */
async function run<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    if (error instanceof DocumentError) throw new Error(error.message)
    throw error
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.appInfo, () => ({ name: 'Dulidan Ledger', version: app.getVersion() }))
  ipcMain.handle(IPC.settingsGet, () => settingsFile.get())
  ipcMain.handle(IPC.settingsUpdate, (_event, patch: Partial<Settings>) => settingsFile.update(patch))

  ipcMain.handle(IPC.dataGet, () => snapshotForWindow())
  ipcMain.handle(IPC.companySave, async (_event, company: CompanyData) => {
    await store.saveCompany(company)
    return snapshotForWindow()
  })
  ipcMain.handle(IPC.customerSave, async (_event, customer: Omit<Customer, 'id'> & { id?: string }) => {
    await store.saveCustomer(customer)
    return snapshotForWindow()
  })
  ipcMain.handle(IPC.customerRemove, async (_event, id: string) => {
    await run(() => store.removeCustomer(id))
    return snapshotForWindow()
  })

  ipcMain.handle(IPC.documentCreate, async (_event, kind: DocumentKind, customerId: string | null) => {
    await store.createDocument(kind, customerId)
    return snapshotForWindow()
  })
  ipcMain.handle(IPC.documentUpdate, async (_event, id: string, patch: { customerId?: string | null; items?: Item[]; note?: string; date?: string }) => {
    await run(() => store.updateDraft(id, patch))
    return snapshotForWindow()
  })
  ipcMain.handle(IPC.documentRemove, async (_event, id: string) => {
    await run(() => store.deleteDraft(id))
    return snapshotForWindow()
  })
  ipcMain.handle(IPC.documentIssue, async (_event, id: string) => {
    await run(() => store.issue(id))
    return snapshotForWindow()
  })
  ipcMain.handle(IPC.documentCancel, async (_event, id: string) => {
    await run(() => store.cancel(id))
    return snapshotForWindow()
  })
  ipcMain.handle(IPC.documentToInvoice, async (_event, id: string) => {
    await run(() => store.offerToInvoice(id))
    return snapshotForWindow()
  })

  ipcMain.handle(IPC.paymentAdd, async (_event, id: string, payment: Omit<Payment, 'id'>) => {
    await run(() => store.addPayment(id, { date: String(payment?.date ?? ''), amountCents: Number(payment?.amountCents), note: String(payment?.note ?? '') }))
    return snapshotForWindow()
  })
  ipcMain.handle(IPC.paymentRemove, async (_event, id: string, paymentId: string) => {
    await run(() => store.removePayment(id, paymentId))
    return snapshotForWindow()
  })
  ipcMain.handle(IPC.reminderAdd, async (_event, id: string) => {
    await run(() => store.addReminder(id))
    return snapshotForWindow()
  })
  ipcMain.handle(IPC.billingSave, async (_event, billing: BillingSettings) => {
    await store.saveBilling(billing)
    return snapshotForWindow()
  })

  // Export for the tax advisor: invoices of a period as DATEV "Buchungsstapel".
  ipcMain.handle(IPC.datevExport, async (event, from: string, to: string) => {
    const valid = (date: unknown): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    if (!valid(from) || !valid(to) || from > to) throw new Error('Bitte einen gültigen Zeitraum wählen.')
    const settings = store.data().billing.datev
    if (!settings.consultantNumber || !settings.clientNumber) throw new Error('Bitte zuerst unter Firma & Einstellungen die Berater- und Mandantennummer eintragen.')
    const bookings = datevBookings(store.data().documents, settings, from, to)
    if (bookings.length === 0) throw new Error('In diesem Zeitraum gibt es keine ausgestellten Rechnungen.')
    const window = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: 'DATEV-Export speichern',
      defaultPath: join(app.getPath('documents'), `EXTF_Buchungsstapel_${from}_${to}.csv`),
      filters: [{ name: 'DATEV-CSV', extensions: ['csv'] }]
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    await atomicWriteFile(result.filePath, encodeWindows1252(datevCsv(bookings, settings, from, to, new Date())))
    return { path: result.filePath, bookings: bookings.length }
  })

  // The window shows the document in print layout. Only that page goes into the PDF.
  ipcMain.handle(IPC.pdfExport, async (event, suggestedName: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    const result = await dialog.showSaveDialog(window, {
      title: 'PDF speichern',
      defaultPath: `${suggestedName.replace(/[\\/:*?"<>|]/g, '-')}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null
    await atomicWriteFile(result.filePath, await renderPdf(window.webContents))
    return result.filePath
  })
}

void app.whenReady().then(async () => {
  startAutoUpdate('ledger')
  const dir = app.getPath('userData')
  store = new LedgerStore(join(dir, 'ledger-data.json'))
  settingsFile = new JsonFile<Settings>(join(dir, 'settings.json'), normalizeSettings)
  await Promise.all([store.load(), settingsFile.load()])
  registerIpc()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
