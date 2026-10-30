import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { normalizeSettings, type Settings } from '@dulidan/core'
import { JsonFile, atomicWriteFile } from '@dulidan/core/node'
import { renderPdf, startAutoUpdate } from '@dulidan/core/electron'
import { IPC, type OpenedDeck } from '../shared/api'
import { parseFile, serializeFile, type Deck } from './deck'

// Tests and the "wie neu" start use their own folder, so real data stays untouched.
if (process.env['PRISM_USER_DATA']) app.setPath('userData', process.env['PRISM_USER_DATA'])

const devServerUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined
const FILTER = [{ name: 'Prism-Präsentation', extensions: ['prism'] }]

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Dulidan Prism',
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

/** Crash backup: a copy of the unsaved deck, removed again after a normal save. */
function recoveryPath(): string {
  return join(app.getPath('userData'), 'recovery.prism')
}

async function saveTo(path: string, deck: Deck): Promise<void> {
  await atomicWriteFile(path, serializeFile(deck))
}

function registerIpc(settingsFile: JsonFile<Settings>): void {
  ipcMain.handle(IPC.appInfo, () => ({ name: 'Dulidan Prism', version: app.getVersion() }))
  ipcMain.handle(IPC.settingsGet, () => settingsFile.get())
  ipcMain.handle(IPC.settingsUpdate, (_event, patch: Partial<Settings>) => settingsFile.update(patch))

  ipcMain.handle(IPC.fileOpen, async (event): Promise<OpenedDeck | null> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    const result = await dialog.showOpenDialog(window, { title: 'Präsentation öffnen', filters: FILTER, properties: ['openFile'] })
    if (result.canceled || !result.filePaths[0]) return null
    const path = result.filePaths[0]
    return { deck: parseFile(await readFile(path, 'utf8')), path }
  })

  ipcMain.handle(IPC.fileSave, async (event, deck: Deck, path: string | null): Promise<string | null> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    let target = path
    if (!target) {
      if (!window) return null
      const result = await dialog.showSaveDialog(window, {
        title: 'Präsentation speichern',
        defaultPath: `${deck.title.replace(/[\\/:*?"<>|]/g, '-') || 'Präsentation'}.prism`,
        filters: FILTER
      })
      if (result.canceled || !result.filePath) return null
      target = result.filePath.endsWith('.prism') ? result.filePath : `${result.filePath}.prism`
    }
    await saveTo(target, deck)
    await rm(recoveryPath(), { force: true })
    return target
  })

  // Crash backup of unsaved changes. Written by the window every few seconds while editing.
  ipcMain.handle(IPC.recoverySave, (_event, deck: Deck) => saveTo(recoveryPath(), deck))
  ipcMain.handle(IPC.recoveryLoad, async (): Promise<Deck | null> => {
    try {
      return parseFile(await readFile(recoveryPath(), 'utf8'))
    } catch {
      return null
    }
  })
  ipcMain.handle(IPC.recoveryDiscard, () => rm(recoveryPath(), { force: true }))

  // The window shows all slides in print layout first. Only that goes into the PDF.
  ipcMain.handle(IPC.pdfExport, async (event, suggestedName: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    const result = await dialog.showSaveDialog(window, {
      title: 'Als PDF speichern',
      defaultPath: `${suggestedName.replace(/[\\/:*?"<>|]/g, '-') || 'Präsentation'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null
    await atomicWriteFile(result.filePath, await renderPdf(window.webContents))
    return result.filePath
  })
}

void app.whenReady().then(async () => {
  startAutoUpdate('prism')
  const settingsFile = new JsonFile<Settings>(join(app.getPath('userData'), 'settings.json'), normalizeSettings)
  await settingsFile.load()
  registerIpc(settingsFile)
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
