import { join } from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { normalizeSettings, type Settings } from '@dulidan/core'
import { JsonFile } from '@dulidan/core/node'
import { startAutoUpdate } from '@dulidan/core/electron'
import { verifySmtp } from '@dulidan/mail-core'
import { IPC, type RadarConfigPatch } from '../shared/api'
import { RadarConfigStore, radarDataDir } from './config'
import { findEmailOnWebsite, RadarStore, searchPlaces } from './leads'
import { Outbox, type SendProgress, type SendSettings } from './outbox'
import { renderLeadMail, templateById, TEMPLATES } from './templates'

// Tests and the "wie neu" start use their own folder, so real data stays untouched.
if (process.env['RADAR_USER_DATA']) app.setPath('userData', process.env['RADAR_USER_DATA'])

const devServerUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined

let store: RadarStore
let config: RadarConfigStore
let settingsFile: JsonFile<Settings>
let outbox: Outbox

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Dulidan Radar',
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

function sendProgress(progress: SendProgress): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(IPC.sendProgress, progress)
}

function sendSettingsInput(): SendSettings {
  const value = config.get()
  return {
    senderName: value.senderName,
    senderEmail: value.senderEmail,
    dailyLimit: value.dailyLimit,
    pauseMinSeconds: value.pauseMinSeconds,
    pauseMaxSeconds: value.pauseMaxSeconds
  }
}

function registerIpc(): void {
  // Settings shared by all Dulidan apps (mode, theme, animations)
  ipcMain.handle(IPC.settingsGet, () => settingsFile.get())
  ipcMain.handle(IPC.settingsUpdate, (_event, patch: Partial<Settings>) => settingsFile.update(patch))

  ipcMain.handle(IPC.appInfo, () => ({ name: 'Dulidan Radar', version: app.getVersion() }))

  ipcMain.handle(IPC.configGet, () => config.get())
  ipcMain.handle(IPC.configUpdate, (_event, patch: RadarConfigPatch) => config.update(patch))
  ipcMain.handle(IPC.configSecrets, (_event, secrets: { placesKey?: string; smtpPassword?: string }) => config.saveSecrets(secrets))

  ipcMain.handle(IPC.smtpTest, async () => {
    const login = config.smtpLogin()
    if (!login) return { ok: false, message: 'Bitte Server, Benutzername und Passwort eintragen.' }
    try {
      await verifySmtp(login)
      return { ok: true, message: 'Der Mailserver hat die Anmeldung angenommen.' }
    } catch (error) {
      return { ok: false, message: 'Die Anmeldung hat nicht geklappt: ' + (error instanceof Error ? error.message : String(error)) }
    }
  })

  ipcMain.handle(IPC.searchRun, async () => {
    const key = config.placesKey()
    if (!key) throw new Error('Bitte zuerst den Google-Schlüssel unter Einstellungen eintragen.')
    const { branche, ort } = config.get()
    const places = await searchPlaces(key, branche, ort)
    const added = await store.addLeads(places)
    return {
      found: places.length,
      added,
      message: added === 0 ? 'Keine neuen Firmen gefunden.' : `${added} neue Firmen gefunden.`
    }
  })

  ipcMain.handle(IPC.leadsList, () => store.leads())
  ipcMain.handle(IPC.leadsUpdate, async (_event, id: string, patch: { status?: 'neu' | 'kontaktiert' | 'antwort' | 'kein_interesse'; note?: string; email?: string | null }) => {
    await store.updateLead(id, patch)
    return store.leads()
  })
  ipcMain.handle(IPC.leadsRemove, async (_event, id: string) => {
    await store.removeLead(id)
    return store.leads()
  })
  ipcMain.handle(IPC.leadsCheckWebsite, async (_event, id: string) => {
    const lead = store.leads().find((item) => item.id === id)
    if (lead?.website) {
      const email = await findEmailOnWebsite(lead.website)
      await store.updateLead(id, { email, checkedAt: Date.now() })
    } else if (lead) {
      await store.updateLead(id, { checkedAt: Date.now() })
    }
    return store.leads()
  })

  ipcMain.handle(IPC.blocklistGet, () => store.data().blocklist)
  ipcMain.handle(IPC.blocklistSet, async (_event, entries: string[]) => {
    await store.setBlocklist(entries)
    return store.data().blocklist
  })

  ipcMain.handle(IPC.templatesList, () => TEMPLATES.map((template) => ({ id: template.id, label: template.label })))
  ipcMain.handle(IPC.templatesPreview, (_event, templateId: string, leadId: string | null) => {
    const template = templateById(templateId)
    const lead = leadId ? store.leads().find((item) => item.id === leadId) : undefined
    const { mail, html } = renderLeadMail(template, null, lead?.name ?? 'Beispiel Zimmerei GmbH')
    return { subject: mail.subject, body: mail.body, html, hasAddress: Boolean(lead?.email) }
  })

  ipcMain.handle(IPC.sendStart, async (_event, leadIds: string[], templateId: string) => {
    if (outbox.status().state === 'laeuft') throw new Error('Es läuft schon ein Versand.')
    if (!config.smtpLogin()) throw new Error('Bitte zuerst die Mail-Einstellungen eintragen und testen.')
    // Runs in the background; progress arrives as events, errors end up in the progress.
    void outbox.start(leadIds, templateById(templateId)).catch((error: unknown) => {
      sendProgress({ ...outbox.status(), state: 'fehler', message: error instanceof Error ? error.message : String(error) })
    })
    return outbox.status()
  })
  ipcMain.handle(IPC.sendStop, () => {
    outbox.stop()
    return outbox.status()
  })
  ipcMain.handle(IPC.sendStatus, () => outbox.status())
}

function buildOutbox(): Outbox {
  return new Outbox({
    store,
    login: () => config.smtpLogin(),
    settings: sendSettingsInput,
    report: sendProgress
  })
}

void app.whenReady().then(async () => {
  startAutoUpdate('radar')
  const dir = radarDataDir()
  store = new RadarStore(join(dir, 'radar-data.json'))
  config = new RadarConfigStore(join(dir, 'radar.json'), join(dir, 'radar-secrets.json'))
  settingsFile = new JsonFile<Settings>(join(dir, 'settings.json'), normalizeSettings)
  await Promise.all([store.load(), config.load(), settingsFile.load()])
  outbox = buildOutbox()
  registerIpc()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

