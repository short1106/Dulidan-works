import { createHash } from 'node:crypto'
import { mkdir, stat } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, net, protocol, session, shell, type IpcMainInvokeEvent } from 'electron'
import { normalizeSettings, type Settings } from '@dulidan/core'
import { renderPdf } from '@dulidan/core/electron'
import { atomicWriteFile, JsonFile, SnapshotStore } from '@dulidan/core/node'
import { isNoteColor, safeName, type NoteColor } from '@dulidan/notes-core'
import { NotesService, VaultError, type ListFilter, type LoadedNote } from '@dulidan/notes-core/node'
import { IPC, normalizePrefs, type CortexPrefs, type ErrorCode, type OpenedNote, type RecoveredNote, type Result, type VaultInfo } from '../shared/ipc'

const BACKGROUND_COLOR = '#0b0614'
const QUICK_NOTE_SHORTCUT = 'CommandOrControl+Shift+Space'
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024
/** Files that could run programs are never opened from a note. */
const BLOCKED_OPEN = new Set(['.exe', '.bat', '.cmd', '.com', '.msi', '.ps1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.jar', '.scr', '.lnk', '.pif', '.reg', '.hta', '.cpl', '.sh', '.app', '.command'])
const devServerUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined

// For testing (development builds only): separate data and notes folders.
if (!app.isPackaged && process.env['CORTEX_USER_DATA']) app.setPath('userData', process.env['CORTEX_USER_DATA'])
const testNotesDir = !app.isPackaged ? process.env['CORTEX_NOTES_DIR'] : undefined

// Pictures in notes are loaded through "cortex://attachments/<name>".
protocol.registerSchemesAsPrivileged([{ scheme: 'cortex', privileges: { standard: true, secure: true, supportFetchAPI: true } }])

const settings = new JsonFile<Settings>(join(app.getPath('userData'), 'settings.json'), normalizeSettings)
const prefs = new JsonFile<CortexPrefs>(join(app.getPath('userData'), 'cortex.json'), normalizePrefs)
const snapshots = new SnapshotStore(join(app.getPath('userData'), 'recovery'), 1)
let service: NotesService
let mainWindow: BrowserWindow | null = null
let quickWindow: BrowserWindow | null = null
let windowDirty = false
let closeConfirmed = false

function broadcast(channel: string, ...args: unknown[]): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, ...args)
}

function errorCode(error: unknown): ErrorCode {
  if (error instanceof VaultError) return error.code
  if (typeof error === 'object' && error && 'code' in error && (error as { code: unknown }).code === 'ENOENT') return 'not-found'
  return 'unknown'
}

/** Runs a job and turns errors into a simple code for the window. */
async function wrap<T>(work: () => Promise<T> | T): Promise<Result<T>> {
  try {
    return { ok: true, value: await work() }
  } catch (error) {
    if (!(error instanceof VaultError)) console.error(error)
    return { ok: false, error: errorCode(error) }
  }
}

function opened(loaded: LoadedNote): OpenedNote {
  return { path: loaded.path, meta: loaded.note.meta, body: loaded.note.body, mtimeMs: loaded.mtimeMs }
}

// ---------- Notes folder ----------

function notesDir(): string {
  return testNotesDir ?? prefs.get().notesDir ?? join(app.getPath('documents'), 'Cortex')
}

/** The index lives with the settings, one file per notes folder. */
function indexFile(root: string): string {
  return join(app.getPath('userData'), 'index', `${createHash('sha1').update(resolve(root)).digest('hex').slice(0, 16)}.sqlite`)
}

async function openVault(): Promise<void> {
  const root = notesDir()
  await mkdir(join(app.getPath('userData'), 'index'), { recursive: true })
  service?.close()
  service = await NotesService.open({ root, indexFile: indexFile(root) })
  service.on('changed', (result) => broadcast(IPC.onNotesChanged, result))
}

function vaultInfo(): VaultInfo {
  return { root: service.vault.root, isDefault: !testNotesDir && prefs.get().notesDir === null, noteCount: service.index.count }
}

// ---------- Windows ----------

function secureWebPreferences(): Electron.WebPreferences {
  return {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    spellcheck: true
  }
}

function lockDown(window: BrowserWindow): void {
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

function loadRenderer(window: BrowserWindow, hash = ''): void {
  if (devServerUrl) void window.loadURL(devServerUrl + hash)
  else void window.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash: hash.slice(1) } : undefined)
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: BACKGROUND_COLOR,
    title: 'Dulidan Cortex',
    autoHideMenuBar: true,
    webPreferences: secureWebPreferences()
  })
  window.once('ready-to-show', () => window.show())
  lockDown(window)
  window.webContents.session.setSpellCheckerLanguages(['de-DE'])
  window.on('close', (event) => {
    if (windowDirty && !closeConfirmed) {
      // Unsaved text: the window saves first, then confirms the close.
      event.preventDefault()
      window.webContents.send(IPC.onCloseRequested)
    }
  })
  window.on('closed', () => {
    mainWindow = null
    windowDirty = false
    closeConfirmed = false
  })
  loadRenderer(window)
  return window
}

/** The small "Schnellnotiz" window. */
function openQuickNote(): void {
  if (quickWindow) {
    quickWindow.show()
    quickWindow.focus()
    return
  }
  quickWindow = new BrowserWindow({
    width: 520,
    height: 420,
    minWidth: 400,
    minHeight: 320,
    show: false,
    alwaysOnTop: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    backgroundColor: BACKGROUND_COLOR,
    title: 'Schnellnotiz – Dulidan Cortex',
    autoHideMenuBar: true,
    webPreferences: secureWebPreferences()
  })
  quickWindow.once('ready-to-show', () => {
    quickWindow?.show()
    quickWindow?.focus()
  })
  lockDown(quickWindow)
  quickWindow.on('closed', () => (quickWindow = null))
  loadRenderer(quickWindow, '#quick')
}

/** The shortcut works in expert and pro mode while Cortex is open. */
function updateQuickNoteShortcut(): boolean {
  globalShortcut.unregister(QUICK_NOTE_SHORTCUT)
  const mode = settings.get().mode
  if (mode !== 'expert' && mode !== 'pro') return false
  return globalShortcut.register(QUICK_NOTE_SHORTCUT, openQuickNote)
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) throw new Error('IPC message from an unknown window')
  return window
}

// ---------- Network and attachments ----------

/** No internet for Cortex: every web request of the windows is stopped. */
function lockDownNetwork(): void {
  const allowedOrigin = devServerUrl ? new URL(devServerUrl).origin : null
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => {
    callback({ cancel: !(allowedOrigin !== null && details.url.startsWith(allowedOrigin)) })
  })
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  protocol.handle('cortex', async (request) => {
    const url = new URL(request.url)
    const file = url.hostname === 'attachments' ? service.vault.attachmentFile(decodeURIComponent(url.pathname.slice(1))) : null
    if (!file) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString()).catch(() => new Response('Not found', { status: 404 }))
  })
}

// ---------- Recovery after a crash ----------

const recoveryId = (path: string): string => createHash('sha1').update(path).digest('hex').slice(0, 24)

async function listRecovered(): Promise<RecoveredNote[]> {
  const result: RecoveredNote[] = []
  for (const doc of await snapshots.listDocuments()) {
    if (!doc.unsaved || !doc.filePath) continue
    const bytes = await snapshots.read(doc.docId, doc.latestSnapshotId)
    result.push({ id: doc.docId, path: doc.filePath, title: doc.title, body: Buffer.from(bytes).toString('utf8'), updatedAt: doc.updatedAt })
  }
  return result
}

// ---------- IPC ----------

function registerIpc(): void {
  ipcMain.handle(IPC.settingsGet, () => settings.get())
  ipcMain.handle(IPC.settingsUpdate, async (_event, patch: Partial<Settings>) => {
    await settings.update(patch)
    updateQuickNoteShortcut()
    return settings.get()
  })
  ipcMain.handle(IPC.prefsGet, () => prefs.get())
  ipcMain.handle(IPC.prefsUpdate, async (_event, patch: Partial<CortexPrefs>) => {
    // The notes folder is changed only through "vault:choose".
    await prefs.update({ layout: patch.layout ?? prefs.get().layout })
    return prefs.get()
  })
  ipcMain.handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    quickNoteShortcut: process.platform === 'darwin' ? 'Cmd+Umschalt+Leertaste' : 'Strg+Umschalt+Leertaste',
    quickNoteActive: globalShortcut.isRegistered(QUICK_NOTE_SHORTCUT)
  }))

  ipcMain.handle(IPC.vaultInfo, () => vaultInfo())
  ipcMain.handle(IPC.vaultChoose, async (event) => {
    const result = await dialog.showOpenDialog(senderWindow(event), {
      title: 'Notizordner wählen',
      defaultPath: service.vault.root,
      properties: ['openDirectory', 'createDirectory']
    })
    const folder = result.filePaths[0]
    if (result.canceled || !folder) return null
    await prefs.update({ notesDir: folder })
    await openVault()
    broadcast(IPC.onVaultChanged)
    return vaultInfo()
  })
  ipcMain.handle(IPC.vaultOpenInExplorer, () => shell.openPath(service.vault.root))
  ipcMain.handle(IPC.rebuildIndex, () => service.rebuildIndex())

  ipcMain.handle(IPC.notesList, (_event, filter?: ListFilter) => service.list(filter))
  ipcMain.handle(IPC.notesSearch, (_event, query: string, filter?: ListFilter) => service.search(String(query ?? ''), filter))
  ipcMain.handle(IPC.noteLoad, (_event, path: string) => wrap(async () => opened(await service.load(path))))
  ipcMain.handle(IPC.noteCreate, (_event, input: { folder?: string; title?: string; color?: NoteColor | null; body?: string }) =>
    wrap(async () =>
      opened(
        await service.create({
          folder: typeof input?.folder === 'string' ? input.folder : '',
          title: typeof input?.title === 'string' ? input.title : undefined,
          color: isNoteColor(input?.color) ? input.color : null,
          body: typeof input?.body === 'string' ? input.body : ''
        })
      )
    )
  )
  ipcMain.handle(IPC.noteSave, (_event, path: string, body: string, expectedMtime: number) =>
    wrap(async () => {
      const saved = await service.save(path, { body: String(body), expectedMtime })
      await snapshots.removeDocument(recoveryId(path))
      return saved
    })
  )
  ipcMain.handle(IPC.noteRename, (_event, path: string, title: string) =>
    wrap(async () => {
      const renamed = await service.rename(path, String(title))
      return { ...opened(renamed), updatedLinks: renamed.updatedLinks }
    })
  )
  ipcMain.handle(IPC.noteMove, (_event, path: string, folder: string) => wrap(() => service.move(path, String(folder ?? ''))))
  ipcMain.handle(IPC.notePin, (_event, path: string, pinned: boolean) => wrap(() => service.setPinned(path, pinned === true)))
  ipcMain.handle(IPC.noteColor, (_event, path: string, color: unknown) => wrap(() => service.setColor(path, isNoteColor(color) ? color : null)))
  ipcMain.handle(IPC.noteTags, (_event, path: string, tags: unknown) =>
    wrap(() => service.setTags(path, Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : []))
  )
  ipcMain.handle(IPC.noteTrash, (_event, path: string) =>
    wrap(async () => {
      const target = await service.moveToTrash(path)
      await snapshots.removeDocument(recoveryId(path))
      return target
    })
  )
  ipcMain.handle(IPC.backlinks, (_event, path: string) => service.backlinks(path))
  ipcMain.handle(IPC.resolveLink, (_event, title: string) => service.resolveLink(String(title)))
  ipcMain.handle(IPC.suggest, (_event, text: string) => service.suggest(String(text ?? '')))
  ipcMain.handle(IPC.tags, () => service.tags())

  ipcMain.handle(IPC.folders, () => service.folders())
  ipcMain.handle(IPC.folderCreate, (_event, parent: string, name: string) => wrap(() => service.createFolder(String(parent ?? ''), String(name))))
  ipcMain.handle(IPC.folderRename, (_event, path: string, name: string) => wrap(() => service.renameFolder(path, String(name))))
  ipcMain.handle(IPC.folderRemove, (_event, path: string) => wrap(() => service.removeFolder(path)))

  ipcMain.handle(IPC.trashList, () => service.trash())
  ipcMain.handle(IPC.trashRestore, (_event, path: string) => wrap(() => service.restore(path)))
  ipcMain.handle(IPC.trashDelete, (_event, path: string) => wrap(() => service.deleteForGood(path)))
  ipcMain.handle(IPC.trashLoad, (_event, path: string) => wrap(async () => opened(await service.vault.readTrash(path))))

  ipcMain.handle(IPC.attachmentSave, (_event, bytes: Uint8Array, name: string): Promise<Result<string>> | Result<string> => {
    if (!(bytes instanceof Uint8Array)) return { ok: false, error: 'invalid-path' }
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) return { ok: false, error: 'too-big' }
    return wrap(() => service.saveAttachment(bytes, String(name || 'datei')))
  })
  ipcMain.handle(IPC.attachmentOpen, (_event, name: string) =>
    wrap(async () => {
      const file = service.vault.attachmentFile(String(name))
      if (!file || BLOCKED_OPEN.has(extname(file).toLowerCase())) throw new VaultError('invalid-path', name)
      await stat(file).catch(() => {
        throw new VaultError('not-found', name)
      })
      const problem = await shell.openPath(file)
      if (problem) throw new Error(problem)
    })
  )
  ipcMain.handle(IPC.openLink, async (_event, url: string) => {
    // Only web and mail addresses; the window asked the user before.
    if (typeof url === 'string' && /^(https?:\/\/|mailto:)/i.test(url)) await shell.openExternal(url)
  })

  ipcMain.handle(IPC.exportPdf, (event, title: string) =>
    wrap(async () => {
      const window = senderWindow(event)
      const result = await dialog.showSaveDialog(window, {
        title: 'Als PDF speichern',
        defaultPath: join(app.getPath('documents'), `${safeName(String(title ?? ''), 'Notiz')}.pdf`),
        filters: [{ name: 'PDF-Dokument', extensions: ['pdf'] }],
        properties: ['showOverwriteConfirmation', 'createDirectory']
      })
      if (result.canceled || !result.filePath) return null
      const file = extname(result.filePath).toLowerCase() === '.pdf' ? result.filePath : `${result.filePath}.pdf`
      await atomicWriteFile(file, await renderPdf(window.webContents))
      return file
    })
  )
  ipcMain.handle(IPC.exportMarkdown, (event, path: string) =>
    wrap(async () => {
      const { note } = await service.load(path)
      const result = await dialog.showSaveDialog(senderWindow(event), {
        title: 'Als Markdown speichern',
        defaultPath: join(app.getPath('documents'), `${safeName(note.meta.title, 'Notiz')}.md`),
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        properties: ['showOverwriteConfirmation', 'createDirectory']
      })
      if (result.canceled || !result.filePath) return null
      const file = extname(result.filePath).toLowerCase() === '.md' ? result.filePath : `${result.filePath}.md`
      await service.exportMarkdown(path, file)
      return file
    })
  )
  ipcMain.handle(IPC.importFiles, (event, folder: string) =>
    wrap(async () => {
      const result = await dialog.showOpenDialog(senderWindow(event), {
        title: 'Notizen importieren',
        defaultPath: app.getPath('documents'),
        filters: [{ name: 'Markdown und Text', extensions: ['md', 'markdown', 'txt'] }],
        properties: ['openFile', 'multiSelections']
      })
      if (result.canceled || result.filePaths.length === 0) return []
      return service.importFiles(result.filePaths, String(folder ?? ''))
    })
  )

  ipcMain.handle(IPC.recoveryPut, async (_event, path: string, title: string, body: string) => {
    await snapshots.save(recoveryId(path), Buffer.from(String(body), 'utf8'), { title: String(title), filePath: path, unsaved: true })
  })
  ipcMain.handle(IPC.recoveryDrop, (_event, path: string) => snapshots.removeDocument(recoveryId(path)))
  ipcMain.handle(IPC.recoveryList, () => listRecovered())
  ipcMain.handle(IPC.recoveryDiscard, (_event, id: string) => snapshots.removeDocument(id))

  ipcMain.handle(IPC.quickNoteSave, (_event, title: string, body: string) =>
    wrap(async () => {
      const note = await service.createQuickNote(String(title ?? ''), String(body ?? ''))
      broadcast(IPC.onNotesChanged, { changed: [note.path], removed: [] })
      return note.path
    })
  )
  ipcMain.handle(IPC.quickNoteClose, () => quickWindow?.close())

  ipcMain.on(IPC.windowSetDirty, (event, dirty: boolean) => {
    if (BrowserWindow.fromWebContents(event.sender) === mainWindow) windowDirty = dirty === true
  })
  ipcMain.on(IPC.windowCloseConfirmed, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window !== mainWindow) return
    closeConfirmed = true
    window?.close()
  })
}

// ---------- Start ----------

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.setAppUserModelId('de.dulidan.cortex')

  void app.whenReady().then(async () => {
    await settings.load()
    await prefs.load()
    await snapshots.beginSession()
    await openVault()
    lockDownNetwork()
    registerIpc()
    Menu.setApplicationMenu(
      process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]) : null
    )
    mainWindow = createMainWindow()
    updateQuickNoteShortcut()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    service?.close()
    void snapshots.endSession()
  })
}
