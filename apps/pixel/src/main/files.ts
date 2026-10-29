import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { app, dialog, type BrowserWindow } from 'electron'
import { addRecentFile, parsePixel, PIXEL_EXTENSION, PixelFormatError, serializePixel, type Settings } from '@dulidan/core'
import { atomicWriteFile, type JsonFile } from '@dulidan/core/node'
import type { ExportImageRequest, FileLocation, FolderKind, OpenResult, SaveProjectRequest, SaveResult } from '../shared/ipc'

const PROJECT_FILTER = { name: 'Pixel-Projekt', extensions: [PIXEL_EXTENSION] }
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg']
/** Images bigger than this are refused, they would not fit in memory. */
const MAX_FILE_BYTES = 200 * 1024 * 1024

/** Where a file lies, in words a beginner understands. */
export function describeLocation(filePath: string): FileLocation {
  const folder = dirname(filePath)
  const known: Array<[FolderKind, string]> = [
    ['pictures', app.getPath('pictures')],
    ['documents', app.getPath('documents')],
    ['desktop', app.getPath('desktop')],
    ['downloads', app.getPath('downloads')]
  ]
  const match = known.find(([, path]) => resolve(path) === resolve(folder))
  return {
    filePath,
    fileName: basename(filePath, extname(filePath)),
    folderKind: match ? match[0] : 'other',
    folderName: basename(folder)
  }
}

function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 120) || 'Bild'
}

/**
 * Opens and saves projects and images. The window may only touch files the
 * user picked in a dialog, opened from the recent list or passed at startup.
 */
export class FileService {
  private readonly allowedPaths = new Set<string>()

  constructor(
    private readonly settings: JsonFile<Settings>,
    private readonly appVersion: string
  ) {}

  allow(filePath: string): void {
    this.allowedPaths.add(resolve(filePath))
  }

  isAllowed(filePath: string): boolean {
    const full = resolve(filePath)
    return this.allowedPaths.has(full) || this.settings.get().recentFiles.some((item) => resolve(item) === full)
  }

  private async rememberRecent(filePath: string): Promise<void> {
    await this.settings.update({ recentFiles: addRecentFile(this.settings.get().recentFiles, filePath) })
  }

  async openDialog(window: BrowserWindow): Promise<OpenResult> {
    const result = await dialog.showOpenDialog(window, {
      title: 'Öffnen',
      defaultPath: app.getPath('pictures'),
      filters: [
        { name: 'Projekte und Bilder', extensions: [PIXEL_EXTENSION, ...IMAGE_EXTENSIONS] },
        PROJECT_FILTER,
        { name: 'Bilder (PNG, JPG)', extensions: IMAGE_EXTENSIONS }
      ],
      properties: ['openFile']
    })
    const filePath = result.filePaths[0]
    if (result.canceled || !filePath) return { ok: false, canceled: true }
    this.allow(filePath)
    return this.openPath(filePath)
  }

  async openPath(filePath: string): Promise<OpenResult> {
    if (!this.isAllowed(filePath)) return { ok: false, error: 'not-allowed' }
    const extension = extname(filePath).slice(1).toLowerCase()
    if (extension !== PIXEL_EXTENSION && !IMAGE_EXTENSIONS.includes(extension)) return { ok: false, error: 'unsupported' }

    let bytes: Uint8Array
    try {
      bytes = await readFile(filePath)
    } catch {
      await this.settings.update({ recentFiles: this.settings.get().recentFiles.filter((item) => item !== filePath) })
      return { ok: false, error: 'not-found' }
    }
    if (bytes.byteLength > MAX_FILE_BYTES) return { ok: false, error: 'unsupported' }

    if (extension !== PIXEL_EXTENSION) {
      // Plain images are opened as a new, unsaved project.
      return {
        ok: true,
        opened: { kind: 'image', name: basename(filePath, extname(filePath)), mime: extension === 'png' ? 'image/png' : 'image/jpeg', bytes }
      }
    }
    try {
      const project = parsePixel(bytes)
      await this.rememberRecent(filePath)
      return { ok: true, opened: { kind: 'project', location: describeLocation(filePath), project } }
    } catch (error) {
      return { ok: false, error: error instanceof PixelFormatError ? error.code : 'damaged' }
    }
  }

  async saveProject(window: BrowserWindow, request: SaveProjectRequest): Promise<SaveResult> {
    let filePath = request.filePath
    if (filePath && !this.isAllowed(filePath)) return { ok: false, error: 'not-allowed' }
    if (!filePath || request.saveAs) {
      const result = await dialog.showSaveDialog(window, {
        title: 'Projekt speichern',
        defaultPath: filePath ?? resolve(app.getPath('pictures'), `${safeFileName(request.suggestedName)}.${PIXEL_EXTENSION}`),
        filters: [PROJECT_FILTER],
        properties: ['showOverwriteConfirmation', 'createDirectory']
      })
      if (result.canceled || !result.filePath) return { ok: false, canceled: true }
      filePath = result.filePath
      if (extname(filePath).toLowerCase() !== `.${PIXEL_EXTENSION}`) filePath += `.${PIXEL_EXTENSION}`
      this.allow(filePath)
    }
    try {
      const project = { ...request.project, modifiedAt: new Date().toISOString() }
      await atomicWriteFile(filePath, serializePixel(project, this.appVersion))
    } catch (error) {
      console.error('Saving failed', error)
      return { ok: false, error: 'write-failed' }
    }
    await this.rememberRecent(filePath)
    return { ok: true, location: describeLocation(filePath) }
  }

  async exportImage(window: BrowserWindow, request: ExportImageRequest): Promise<SaveResult> {
    const extension = request.format === 'png' ? 'png' : 'jpg'
    const result = await dialog.showSaveDialog(window, {
      title: 'Als Bild speichern',
      defaultPath: resolve(app.getPath('pictures'), `${safeFileName(request.suggestedName)}.${extension}`),
      filters: [
        request.format === 'png' ? { name: 'PNG-Bild', extensions: ['png'] } : { name: 'JPG-Bild', extensions: ['jpg', 'jpeg'] }
      ],
      properties: ['showOverwriteConfirmation', 'createDirectory']
    })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    let filePath = result.filePath
    const current = extname(filePath).toLowerCase()
    if (extension === 'png' ? current !== '.png' : current !== '.jpg' && current !== '.jpeg') filePath += `.${extension}`
    try {
      await atomicWriteFile(filePath, request.bytes)
    } catch (error) {
      console.error('Export failed', error)
      return { ok: false, error: 'write-failed' }
    }
    this.allow(filePath)
    return { ok: true, location: describeLocation(filePath) }
  }
}

/** Finds a project or image path among command line arguments. */
export function findFileArgument(argv: readonly string[]): string | null {
  const supported = [PIXEL_EXTENSION, ...IMAGE_EXTENSIONS]
  return argv.slice(1).find((arg) => !arg.startsWith('-') && supported.includes(extname(arg).slice(1).toLowerCase())) ?? null
}
