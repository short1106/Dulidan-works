import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'

// Dark brand background, shown before the renderer has painted.
// Avoids a white flash on startup.
const BACKGROUND_COLOR = '#0b0614'

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
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
      webSecurity: true
    }
  })

  window.once('ready-to-show', () => window.show())

  // Never navigate the app window away, never open new Electron windows.
  // Links with http(s) open in the user's normal browser instead.
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // In development electron-vite serves the renderer with hot reload,
  // in the built app it is a local file.
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

// Only one Glyph process at a time; a second start focuses the first window.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  void app.whenReady().then(() => {
    createMainWindow()

    // macOS: clicking the dock icon reopens a window.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
