import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, shell, type IpcMainInvokeEvent } from 'electron'
import type { Settings } from '@dulidan/core'
import { IPC, type OpenResult, type SaveRequest, type SnapshotRequest } from '../shared/ipc'
import { DocumentService, findGlyphArgument } from './documents'
import { exportPdf, printDocument } from './printing'
import { RecoveryService } from './recovery'
import { SettingsService } from './settings'

// Dark brand background, shown before the window has painted.
// Avoids a white flash on startup.
const BACKGROUND_COLOR = '#0b0614'

// For testing: GLYPH_USER_DATA points the app to a separate data folder,
// so the first-start screen can be tried without touching real settings.
if (process.env['GLYPH_USER_DATA']) app.setPath('userData', process.env['GLYPH_USER_DATA'])

const appVersion = app.getVersion()
const settings = new SettingsService()
const documents = new DocumentService(settings, appVersion)
const recovery = new RecoveryService(documents, appVersion)

let mainWindow: BrowserWindow | null = null
/** File to open once the window is ready (double-click on a .glyph file). */
let launchFile: string | null = findGlyphArgument(process.argv)
/** Set by the window: true while there are unsaved changes. */
let windowDirty = false
let closeConfirmed = false
/** PDFs exported in this session, for "Ordner zeigen". */
const exportedFiles = new Set<string>()

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 820,
    minHeight: 560,
    show: false,
    backgroundColor: BACKGROUND_COLOR,
    title: 'Dulidan Glyph',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Security: the window gets no Node access, only what preload exposes.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true
    }
  })

  window.once('ready-to-show', () => window.show())

  // Never navigate the app window away, never open new Electron windows.
  // Links with http(s) open in the user's normal browser instead.
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // German spell checking, done locally by Chromium.
  window.webContents.session.setSpellCheckerLanguages(['de-DE'])

  // Unsaved changes: ask the window first, it shows "Speichern?".
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

  // In development electron-vite serves the window with live reload,
  // in the built app it is a local file.
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

/** The window that sent an IPC message. */
function senderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) throw new Error('IPC message from an unknown window')
  return window
}

/** Opens a file in the running window, e.g. on a second double-click. */
async function openInWindow(filePath: string): Promise<void> {
  documents.allow(filePath)
  if (!mainWindow) {
    launchFile = filePath
    mainWindow = createMainWindow()
    return
  }
  const result: OpenResult = await documents.openPath(filePath)
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
  mainWindow.webContents.send(IPC.fileOpenRequested, result)
}

function registerIpc(): void {
  ipcMain.handle(IPC.appInfo, () => ({ version: appVersion, platform: process.platform }))

  ipcMain.handle(IPC.settingsGet, () => settings.get())
  ipcMain.handle(IPC.settingsUpdate, (_event, patch: Partial<Settings>) => settings.update(patch))
  settings.onChange((value) => mainWindow?.webContents.send(IPC.settingsChanged, value))

  ipcMain.handle(IPC.fileOpenDialog, (event) => documents.openDialog(senderWindow(event)))
  ipcMain.handle(IPC.fileOpenPath, (_event, filePath: string) => documents.openPath(String(filePath)))
  ipcMain.handle(IPC.fileSave, (event, request: SaveRequest) => documents.save(senderWindow(event), request))
  ipcMain.handle(IPC.fileTakeLaunchFile, async () => {
    const filePath = launchFile
    launchFile = null
    if (!filePath) return null
    documents.allow(filePath)
    return documents.openPath(filePath)
  })
  ipcMain.handle(IPC.fileShowInFolder, (_event, filePath: string) => {
    // Only for files Glyph opened, saved or exported, never arbitrary paths.
    if (documents.isAllowed(filePath) || exportedFiles.has(filePath)) shell.showItemInFolder(filePath)
  })

  ipcMain.handle(IPC.recoveryCheck, () => recovery.takeCrashedDocuments())
  ipcMain.handle(IPC.recoverySnapshot, (_event, request: SnapshotRequest) => recovery.snapshot(request))
  ipcMain.handle(IPC.recoveryMarkSaved, (_event, docId: string, title: string, filePath: string | null) =>
    recovery.markSaved(docId, title, filePath)
  )
  ipcMain.handle(IPC.recoveryList, (_event, docId: string) => recovery.list(docId))
  ipcMain.handle(IPC.recoveryLoad, (_event, docId: string, snapshotId?: string) => recovery.load(docId, snapshotId))
  ipcMain.handle(IPC.recoveryDiscard, (_event, docId: string) => recovery.discard(docId))

  ipcMain.handle(IPC.exportPdf, async (event, suggestedName: string) => {
    const result = await exportPdf(senderWindow(event), String(suggestedName))
    if (result.location) exportedFiles.add(result.location.filePath)
    return result
  })
  ipcMain.handle(IPC.print, (event) => printDocument(senderWindow(event)))

  ipcMain.on(IPC.windowSetDirty, (_event, dirty: boolean) => {
    windowDirty = dirty === true
  })
  ipcMain.on(IPC.windowConfirmClose, (event) => {
    closeConfirmed = true
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}

/** macOS needs an app menu for Cmd+Q, copy and paste. Windows and Linux use the in-app menu. */
function setupApplicationMenu(): void {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]))
  } else {
    Menu.setApplicationMenu(null)
  }
}

// Only one Glyph process at a time; a second start hands its file to the first.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = findGlyphArgument(argv)
    if (filePath) {
      void openInWindow(filePath)
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // macOS: a .glyph file opened from Finder.
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (app.isReady()) void openInWindow(filePath)
    else launchFile = filePath
  })

  void app.whenReady().then(async () => {
    await settings.load()
    await recovery.start()
    registerIpc()
    setupApplicationMenu()
    mainWindow = createMainWindow()

    // macOS: clicking the dock icon reopens a window.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // Normal exit: tidy up recovery data (with a short wait for the disk).
  let recoveryStopped = false
  app.on('before-quit', (event) => {
    if (recoveryStopped) return
    event.preventDefault()
    recovery
      .stop()
      .catch((error) => console.error('Recovery cleanup failed', error))
      .finally(() => {
        recoveryStopped = true
        app.quit()
      })
  })
}
