import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, shell, type IpcMainInvokeEvent } from 'electron'
import { normalizeSettings, type Settings } from '@dulidan/core'
import { JsonFile } from '@dulidan/core/node'
import {
  IPC,
  normalizePrefs,
  type ExportImageRequest,
  type PixelPrefs,
  type SaveProjectRequest,
  type SnapshotRequest
} from '../shared/ipc'
import { FileService, findFileArgument } from './files'
import { RecoveryService } from './recovery'

const BACKGROUND_COLOR = '#0b0614'

// For testing: PIXEL_USER_DATA points the app to a separate data folder,
// so the first start can be tried without touching real settings.
if (process.env['PIXEL_USER_DATA']) app.setPath('userData', process.env['PIXEL_USER_DATA'])

const appVersion = app.getVersion()
const settings = new JsonFile<Settings>(join(app.getPath('userData'), 'settings.json'), normalizeSettings)
const prefs = new JsonFile<PixelPrefs>(join(app.getPath('userData'), 'werkzeuge.json'), normalizePrefs)
const files = new FileService(settings, appVersion)
const recovery = new RecoveryService(files, appVersion)

let mainWindow: BrowserWindow | null = null
let launchFile: string | null = findFileArgument(process.argv)
let windowDirty = false
let closeConfirmed = false

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: BACKGROUND_COLOR,
    title: 'Dulidan Pixel',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Security: no Node access in the window, only what preload exposes.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

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

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) void window.loadURL(devServerUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
  return window
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) throw new Error('IPC message from an unknown window')
  return window
}

async function openInWindow(filePath: string): Promise<void> {
  files.allow(filePath)
  if (!mainWindow) {
    launchFile = filePath
    mainWindow = createMainWindow()
    return
  }
  const result = await files.openPath(filePath)
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
  mainWindow.webContents.send(IPC.fileOpenRequested, result)
}

function registerIpc(): void {
  ipcMain.handle(IPC.appInfo, () => ({ version: appVersion, platform: process.platform }))
  ipcMain.handle(IPC.settingsGet, () => settings.get())
  ipcMain.handle(IPC.settingsUpdate, (_event, patch: Partial<Settings>) => settings.update(patch))
  ipcMain.handle(IPC.prefsGet, () => prefs.get())
  ipcMain.handle(IPC.prefsUpdate, (_event, patch: Partial<PixelPrefs>) => prefs.update(patch))

  ipcMain.handle(IPC.fileOpenDialog, (event) => files.openDialog(senderWindow(event)))
  ipcMain.handle(IPC.fileOpenPath, (_event, filePath: string) => files.openPath(String(filePath)))
  ipcMain.handle(IPC.fileSaveProject, (event, request: SaveProjectRequest) => files.saveProject(senderWindow(event), request))
  ipcMain.handle(IPC.fileExportImage, (event, request: ExportImageRequest) => files.exportImage(senderWindow(event), request))
  ipcMain.handle(IPC.fileTakeLaunchFile, async () => {
    const filePath = launchFile
    launchFile = null
    if (!filePath) return null
    files.allow(filePath)
    return files.openPath(filePath)
  })
  ipcMain.handle(IPC.fileShowInFolder, (_event, filePath: string) => {
    if (files.isAllowed(filePath)) shell.showItemInFolder(filePath)
  })

  ipcMain.handle(IPC.recoveryCheck, () => recovery.takePending())
  ipcMain.handle(IPC.recoverySnapshot, (_event, request: SnapshotRequest) => recovery.snapshot(request))
  ipcMain.handle(IPC.recoveryMarkSaved, (_event, docId: string, title: string, filePath: string | null) =>
    recovery.markSaved(docId, title, filePath)
  )
  ipcMain.handle(IPC.recoveryLoad, (_event, docId: string) => recovery.load(docId))
  ipcMain.handle(IPC.recoveryDiscard, (_event, docId: string) => recovery.discard(docId))

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
  app.on('second-instance', (_event, argv) => {
    const filePath = findFileArgument(argv)
    if (filePath) void openInWindow(filePath)
    else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (app.isReady()) void openInWindow(filePath)
    else launchFile = filePath
  })

  void app.whenReady().then(async () => {
    await settings.load()
    await prefs.load()
    await recovery.start()
    registerIpc()
    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]))
    } else {
      Menu.setApplicationMenu(null)
    }
    mainWindow = createMainWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

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
