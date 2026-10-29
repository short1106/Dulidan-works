import { startAutoUpdate } from '@dulidan/core/electron'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, shell, type IpcMainInvokeEvent } from 'electron'
import { normalizeSettings, type Settings } from '@dulidan/core'
import { atomicWriteFile, JsonFile } from '@dulidan/core/node'
import {
  classifyError,
  MailService,
  parseIcs,
  PROVIDER_PRESETS,
  utcToLocal,
  type AccountInput,
  type CalendarEventInput,
  type DraftInput
} from '@dulidan/mail-core'
import { IPC, normalizePrefs, type IcsImportSummary, type RelayPrefs, type Result, type SendRequest, type SyncState } from '../shared/ipc'
import { fetchRemoteImages, lockDownWindowNetwork } from './network'
import { systemSecretBox, testSecretBox } from './secrets'

const BACKGROUND_COLOR = '#0b0614'
const devServerUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined

// For testing: RELAY_USER_DATA points to a separate data folder.
if (process.env['RELAY_USER_DATA']) app.setPath('userData', process.env['RELAY_USER_DATA'])
// Test mode (development builds only): no key store needed, local test servers without TLS.
const testMode = !app.isPackaged && process.env['RELAY_TEST_MODE'] === '1'

const settings = new JsonFile<Settings>(join(app.getPath('userData'), 'settings.json'), normalizeSettings)
const prefs = new JsonFile<RelayPrefs>(join(app.getPath('userData'), 'relay.json'), normalizePrefs)
let service: MailService
let mainWindow: BrowserWindow | null = null
let windowDirty = false
let closeConfirmed = false
let pollTimer: NodeJS.Timeout | null = null
const syncState: SyncState = { syncing: false, errors: {}, lastSync: null }

function broadcast(channel: string, ...args: unknown[]): void {
  mainWindow?.webContents.send(channel, ...args)
}

/** Runs a job and turns errors into a simple code for the window. */
async function wrap<T>(work: () => Promise<T> | T): Promise<Result<T>> {
  try {
    return { ok: true, value: await work() }
  } catch (error) {
    console.error(error)
    return { ok: false, error: classifyError(error), message: error instanceof Error ? error.message : String(error) }
  }
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    show: false,
    backgroundColor: BACKGROUND_COLOR,
    title: 'Dulidan Relay',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true
    }
  })
  window.once('ready-to-show', () => window.show())
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.session.setSpellCheckerLanguages(['de-DE'])
  window.on('close', (event) => {
    if (windowDirty && !closeConfirmed) {
      event.preventDefault()
      window.webContents.send(IPC.windowCloseRequested)
    }
  })
  window.on('closed', () => {
    mainWindow = null
    windowDirty = false
    closeConfirmed = false
  })
  if (devServerUrl) void window.loadURL(devServerUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
  return window
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) throw new Error('IPC message from an unknown window')
  return window
}

// ---------- Fetching ----------

async function syncNow(accountId?: string, folder?: string): Promise<void> {
  syncState.syncing = true
  broadcast(IPC.onSyncState, syncState)
  const ids = accountId ? [accountId] : service.accounts.list().map((account) => account.id)
  await Promise.all(
    ids.map(async (id) => {
      try {
        await service.syncAccount(id, folder ? [folder] : [])
        delete syncState.errors[id]
      } catch (error) {
        syncState.errors[id] = classifyError(error)
      }
    })
  )
  syncState.syncing = false
  syncState.lastSync = Date.now()
  broadcast(IPC.onSyncState, syncState)
  broadcast(IPC.onChanged)
}

function schedulePolling(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(() => void syncNow(), prefs.get().pollMinutes * 60_000)
}

function showNotification(title: string, body: string, onClick?: () => void): void {
  if (!prefs.get().notifications || !Notification.isSupported()) return
  const notification = new Notification({ title, body, silent: false })
  notification.on('click', () => {
    if (!mainWindow) mainWindow = createMainWindow()
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    onClick?.()
  })
  notification.show()
}

function watchReminders(): void {
  const check = (): void => {
    for (const { event, occurrence } of service.calendar.takeDueReminders(Date.now())) {
      const local = utcToLocal(occurrence.startUtc, event.timeZone)
      const time = event.allDay ? 'ganztägig' : `um ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')} Uhr`
      showNotification(`Termin: ${event.title}`, `${local.day}.${local.month}.${local.year} ${time}${event.location ? ` · ${event.location}` : ''}`)
    }
  }
  check()
  setInterval(check, 30_000)
}

// ---------- IPC ----------

function safeName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 150) || 'Anhang'
}

function importIcsText(text: string): IcsImportSummary {
  const parsed = parseIcs(text)
  const counts = service.calendar.importEvents(parsed.events)
  return { ...counts, simplified: parsed.simplified }
}

function registerIpc(): void {
  ipcMain.handle(IPC.appInfo, () => ({ version: app.getVersion(), platform: process.platform, secureStorage: (testSecretBox() ?? systemSecretBox).isAvailable() }))
  ipcMain.handle(IPC.settingsGet, () => settings.get())
  ipcMain.handle(IPC.settingsUpdate, (_event, patch: Partial<Settings>) => settings.update(patch))
  ipcMain.handle(IPC.prefsGet, () => prefs.get())
  ipcMain.handle(IPC.prefsUpdate, async (_event, patch: Partial<RelayPrefs>) => {
    const next = await prefs.update(patch)
    schedulePolling()
    return next
  })

  ipcMain.handle(IPC.accountsList, () => service.accounts.list())
  ipcMain.handle(IPC.accountsPresets, () => PROVIDER_PRESETS)
  ipcMain.handle(IPC.accountsTest, (_event, input: AccountInput, password: string) => service.testConnection(input, String(password)))
  ipcMain.handle(IPC.accountsAdd, (_event, input: AccountInput, password: string) =>
    wrap(async () => {
      const account = await service.addAccount(input, String(password))
      void syncNow(account.id)
      return account
    })
  )
  ipcMain.handle(IPC.accountsUpdate, (_event, id: string, patch: Partial<AccountInput>, password?: string) =>
    wrap(() => service.updateAccount(id, patch, password || undefined))
  )
  ipcMain.handle(IPC.accountsRemove, async (_event, id: string) => {
    await service.removeAccount(id)
    broadcast(IPC.onChanged)
  })

  ipcMain.handle(IPC.mailSync, (_event, accountId?: string, folder?: string) => syncNow(accountId ?? undefined, folder ?? undefined))
  ipcMain.handle(IPC.mailSyncState, () => syncState)
  ipcMain.handle(IPC.mailFolders, (_event, accountId: string) => service.folders(accountId))
  ipcMain.handle(IPC.mailMessages, (_event, accountId: string | null, folder: string | null) => {
    if (accountId && folder) return service.messages(accountId, folder)
    // All inboxes together.
    return service.accounts
      .list()
      .flatMap((account) => {
        const inbox = service.cache.findFolder(account.id, 'inbox')
        return inbox ? service.messages(account.id, inbox) : []
      })
      .sort((a, b) => b.date - a.date)
      .slice(0, 300)
  })
  ipcMain.handle(IPC.mailMessage, (_event, id: number) => wrap(() => service.message(Number(id))))
  ipcMain.handle(IPC.mailSetSeen, (_event, id: number, seen: boolean) => wrap(() => service.setSeen(Number(id), seen === true)))
  ipcMain.handle(IPC.mailTrash, (_event, id: number) => wrap(() => service.moveToTrash(Number(id))))
  ipcMain.handle(IPC.mailSearch, (_event, query: string) => service.search(String(query)))
  ipcMain.handle(IPC.mailSaveAttachment, (event, id: number, index: number) =>
    wrap(async () => {
      const attachment = await service.attachment(Number(id), Number(index))
      const result = await dialog.showSaveDialog(senderWindow(event), {
        title: 'Anhang speichern',
        defaultPath: resolve(app.getPath('downloads'), safeName(attachment.filename)),
        properties: ['showOverwriteConfirmation', 'createDirectory']
      })
      if (result.canceled || !result.filePath) return null
      await atomicWriteFile(result.filePath, attachment.content)
      return result.filePath
    })
  )
  ipcMain.handle(IPC.mailPreviewAttachment, (_event, id: number, index: number) =>
    wrap(async () => {
      const attachment = await service.attachment(Number(id), Number(index))
      if (!/^image\/(png|jpe?g|gif|webp|bmp)$/i.test(attachment.contentType)) throw new Error('No preview for this type')
      return `data:${attachment.contentType};base64,${attachment.content.toString('base64')}`
    })
  )
  ipcMain.handle(IPC.mailAttachmentData, (_event, id: number, index: number) =>
    wrap(async () => {
      const attachment = await service.attachment(Number(id), Number(index))
      return { filename: attachment.filename, contentType: attachment.contentType, content: new Uint8Array(attachment.content) }
    })
  )
  ipcMain.handle(IPC.mailImportIcsAttachment, (_event, id: number, index: number) =>
    wrap(async () => {
      const attachment = await service.attachment(Number(id), Number(index))
      const summary = importIcsText(attachment.content.toString('utf8'))
      broadcast(IPC.onChanged)
      return summary
    })
  )
  ipcMain.handle(IPC.mailLoadRemoteImages, (_event, urls: string[]) => fetchRemoteImages(Array.isArray(urls) ? urls.map(String) : []))
  ipcMain.handle(IPC.mailOpenLink, async (_event, url: string) => {
    // Only web addresses go to the browser; everything else is ignored.
    if (/^https?:\/\//i.test(String(url))) await shell.openExternal(String(url))
  })
  ipcMain.handle(IPC.mailSend, (_event, request: SendRequest) =>
    wrap(async () => {
      const result = await service.send(
        request.accountId,
        {
          to: request.to,
          cc: request.cc,
          bcc: request.bcc,
          subject: request.subject,
          html: request.html,
          text: request.text,
          attachments: request.attachments.map((item) => ({ ...item, content: Buffer.from(item.content) })),
          inReplyTo: request.inReplyTo,
          references: request.references
        },
        { confirmManyRecipients: request.confirmManyRecipients === true }
      )
      if (request.draftId) service.drafts.remove(request.draftId)
      void syncNow(request.accountId)
      return result
    })
  )
  ipcMain.handle(IPC.mailRemaining, (_event, accountId: string) => service.remainingToday(accountId))

  ipcMain.handle(IPC.draftsList, () => service.drafts.list())
  ipcMain.handle(IPC.draftsSave, (_event, draft: DraftInput) => service.drafts.save(draft))
  ipcMain.handle(IPC.draftsRemove, (_event, id: string) => service.drafts.remove(id))

  ipcMain.handle(IPC.calendarRange, (_event, fromUtc: number, toUtc: number) => service.calendar.occurrences(Number(fromUtc), Number(toUtc)))
  ipcMain.handle(IPC.calendarAdd, (_event, input: CalendarEventInput) => wrap(() => service.calendar.add(input)))
  ipcMain.handle(IPC.calendarUpdate, (_event, id: string, input: CalendarEventInput) => wrap(() => service.calendar.update(id, input)))
  ipcMain.handle(IPC.calendarRemove, (_event, id: string) => service.calendar.remove(id))
  ipcMain.handle(IPC.calendarImportFile, (event) =>
    wrap(async () => {
      const result = await dialog.showOpenDialog(senderWindow(event), {
        title: 'Kalenderdatei importieren',
        filters: [{ name: 'Kalender (.ics)', extensions: ['ics'] }],
        properties: ['openFile']
      })
      const filePath = result.filePaths[0]
      if (result.canceled || !filePath) return null
      return importIcsText(await readFile(filePath, 'utf8'))
    })
  )

  ipcMain.on(IPC.windowSetDirty, (_event, dirty: boolean) => {
    windowDirty = dirty === true
  })
  ipcMain.on(IPC.windowConfirmClose, (event) => {
    closeConfirmed = true
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  // Windows shows notifications only with an app id.
  app.setAppUserModelId('de.dulidan.relay')

  void app.whenReady().then(async () => {
    startAutoUpdate('relay')
    lockDownWindowNetwork(devServerUrl)
    await settings.load()
    await prefs.load()
    service = await MailService.open({
      dataDir: join(app.getPath('userData'), 'Mail'),
      secrets: testSecretBox() ?? systemSecretBox,
      allowInsecureTls: testMode
    })
    service.on('newMail', ({ messages }) => {
      const first = messages[0]
      if (!first) return
      const title = messages.length === 1 ? `Neue Mail von ${first.from?.name || first.from?.address || 'unbekannt'}` : `${messages.length} neue Mails`
      showNotification(title, messages.length === 1 ? first.subject || '(ohne Betreff)' : messages.map((m) => m.subject).slice(0, 3).join(' · '), () =>
        broadcast(IPC.onOpenMessage, first.id)
      )
    })
    registerIpc()
    Menu.setApplicationMenu(
      process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]) : null
    )
    mainWindow = createMainWindow()
    schedulePolling()
    watchReminders()
    mainWindow.webContents.once('did-finish-load', () => void syncNow())
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('will-quit', () => service?.close())
}
