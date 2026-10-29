/**
 * Messages between the window (renderer) and the main process.
 * Shared by main, preload and renderer so both sides agree on names and shapes.
 */
import type { GlyphDocument, Settings, SnapshotInfoLike } from './types'

export type { GlyphDocument, Settings, SnapshotInfoLike }

export const IPC = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsChanged: 'settings:changed',

  fileOpenDialog: 'file:open-dialog',
  fileOpenPath: 'file:open-path',
  fileSave: 'file:save',
  fileTakeLaunchFile: 'file:take-launch-file',
  fileOpenRequested: 'file:open-requested',
  fileShowInFolder: 'file:show-in-folder',

  recoveryCheck: 'recovery:check',
  recoverySnapshot: 'recovery:snapshot',
  recoveryMarkSaved: 'recovery:mark-saved',
  recoveryList: 'recovery:list',
  recoveryLoad: 'recovery:load',
  recoveryDiscard: 'recovery:discard',

  exportPdf: 'export:pdf',
  print: 'export:print',

  windowSetDirty: 'window:set-dirty',
  windowCloseRequested: 'window:close-requested',
  windowConfirmClose: 'window:confirm-close',

  appInfo: 'app:info'
} as const

/** Where a file was saved, so basic mode can say "Gespeichert in Dokumente". */
export type FolderKind = 'documents' | 'desktop' | 'downloads' | 'other'

export interface FileLocation {
  filePath: string
  fileName: string
  folderKind: FolderKind
  folderName: string
}

export interface OpenedDocument {
  /** null for a recovered document that was never saved. */
  location: FileLocation | null
  document: GlyphDocument
}

export type OpenError = 'not-a-glyph-file' | 'newer-version' | 'damaged' | 'not-found' | 'not-allowed'

export type OpenResult = { ok: true; opened: OpenedDocument } | { ok: false; canceled: true } | { ok: false; error: OpenError }

export interface SaveRequest {
  document: GlyphDocument
  /** Current file. null or saveAs -> ask the user for a place. */
  filePath: string | null
  saveAs: boolean
  /** Proposed file name for the save dialog, without extension. */
  suggestedName: string
}

export type SaveResult = { ok: true; location: FileLocation } | { ok: false; canceled: true } | { ok: false; error: 'write-failed' | 'not-allowed' }

export interface SnapshotRequest {
  docId: string
  document: GlyphDocument
  title: string
  filePath: string | null
  unsaved: boolean
}

export interface RecoverableEntry {
  docId: string
  title: string
  filePath: string | null
  updatedAt: string
}

export interface ExportResult {
  ok: boolean
  canceled?: boolean
  location?: FileLocation
}

export interface AppInfo {
  version: string
  platform: string
}
