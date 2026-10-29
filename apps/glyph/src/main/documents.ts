import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { app, dialog, type BrowserWindow } from 'electron'
import { GLYPH_EXTENSION, GlyphFormatError, parseGlyph, serializeGlyph } from '@dulidan/core'
import { atomicWriteFile } from '@dulidan/core/node'
import type { FileLocation, FolderKind, OpenResult, SaveRequest, SaveResult } from '../shared/ipc'
import type { SettingsService } from './settings'

const GLYPH_FILTER = { name: 'Glyph-Dokument', extensions: [GLYPH_EXTENSION] }

/** Describes where a file lies, in words a beginner understands. */
export function describeLocation(filePath: string): FileLocation {
  const folder = dirname(filePath)
  const known: Array<[FolderKind, string]> = [
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

/** Removes characters Windows does not allow in file names. */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 120)
  return cleaned || 'Dokument'
}

/**
 * Opens and saves .glyph files.
 *
 * The window may only touch files the user chose in a dialog, opened from the
 * recent list or passed at startup. Any other path coming from the window is
 * refused, so a bug in the window can never overwrite random files.
 */
export class DocumentService {
  private readonly allowedPaths = new Set<string>()

  constructor(
    private readonly settings: SettingsService,
    private readonly appVersion: string
  ) {}

  /** Allows a path passed on the command line (double-click in Explorer). */
  allow(filePath: string): void {
    this.allowedPaths.add(resolve(filePath))
  }

  isAllowed(filePath: string): boolean {
    const full = resolve(filePath)
    return this.allowedPaths.has(full) || this.settings.get().recentFiles.some((item) => resolve(item) === full)
  }

  async openDialog(window: BrowserWindow): Promise<OpenResult> {
    const result = await dialog.showOpenDialog(window, {
      title: 'Dokument öffnen',
      defaultPath: app.getPath('documents'),
      filters: [GLYPH_FILTER],
      properties: ['openFile']
    })
    const filePath = result.filePaths[0]
    if (result.canceled || !filePath) return { ok: false, canceled: true }
    this.allow(filePath)
    return this.openPath(filePath)
  }

  async openPath(filePath: string): Promise<OpenResult> {
    if (!this.isAllowed(filePath)) return { ok: false, error: 'not-allowed' }
    let bytes: Uint8Array
    try {
      bytes = await readFile(filePath)
    } catch {
      await this.settings.removeRecentFile(filePath)
      return { ok: false, error: 'not-found' }
    }
    try {
      const document = parseGlyph(bytes)
      this.allow(filePath)
      await this.settings.addRecentFile(filePath)
      return { ok: true, opened: { location: describeLocation(filePath), document } }
    } catch (error) {
      return { ok: false, error: error instanceof GlyphFormatError ? error.code : 'damaged' }
    }
  }

  async save(window: BrowserWindow, request: SaveRequest): Promise<SaveResult> {
    let filePath = request.filePath
    if (filePath && !this.isAllowed(filePath)) return { ok: false, error: 'not-allowed' }

    if (!filePath || request.saveAs) {
      const result = await dialog.showSaveDialog(window, {
        title: 'Dokument speichern',
        defaultPath: filePath ?? resolve(app.getPath('documents'), `${safeFileName(request.suggestedName)}.${GLYPH_EXTENSION}`),
        filters: [GLYPH_FILTER],
        properties: ['showOverwriteConfirmation', 'createDirectory']
      })
      if (result.canceled || !result.filePath) return { ok: false, canceled: true }
      filePath = result.filePath
      if (extname(filePath).toLowerCase() !== `.${GLYPH_EXTENSION}`) filePath += `.${GLYPH_EXTENSION}`
      this.allow(filePath)
    }

    try {
      const document = { ...request.document, modifiedAt: new Date().toISOString() }
      await atomicWriteFile(filePath, serializeGlyph(document, this.appVersion))
    } catch (error) {
      console.error('Saving failed', error)
      return { ok: false, error: 'write-failed' }
    }
    await this.settings.addRecentFile(filePath)
    return { ok: true, location: describeLocation(filePath) }
  }
}

/** Finds a .glyph path among command line arguments. */
export function findGlyphArgument(argv: readonly string[]): string | null {
  return argv.slice(1).find((arg) => !arg.startsWith('-') && extname(arg).toLowerCase() === `.${GLYPH_EXTENSION}`) ?? null
}
