/**
 * Messages between the Pixel window (renderer) and the main process.
 * Shared by main, preload and renderer so both sides agree on names and shapes.
 */
import type { PixelProject, Settings, SnapshotInfo } from '@dulidan/core'

export type { PixelProject, Settings, SnapshotInfo }

export const IPC = {
  appInfo: 'app:info',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  prefsGet: 'prefs:get',
  prefsUpdate: 'prefs:update',

  fileOpenDialog: 'file:open-dialog',
  fileOpenPath: 'file:open-path',
  fileSaveProject: 'file:save-project',
  fileExportImage: 'file:export-image',
  fileTakeLaunchFile: 'file:take-launch-file',
  fileOpenRequested: 'file:open-requested',
  fileShowInFolder: 'file:show-in-folder',

  recoveryCheck: 'recovery:check',
  recoverySnapshot: 'recovery:snapshot',
  recoveryMarkSaved: 'recovery:mark-saved',
  recoveryLoad: 'recovery:load',
  recoveryDiscard: 'recovery:discard',

  windowSetDirty: 'window:set-dirty',
  windowCloseRequested: 'window:close-requested',
  windowConfirmClose: 'window:confirm-close'
} as const

/** Settings of the drawing tools that Pixel remembers between starts. */
export interface PixelPrefs {
  /** Last used colors, newest first, as #rrggbb. */
  recentColors: string[]
}

export const MAX_RECENT_COLORS = 12

export function normalizePrefs(raw: unknown): PixelPrefs {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const colors = Array.isArray(input['recentColors'])
    ? input['recentColors'].filter((value): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value))
    : []
  return { recentColors: [...new Set(colors.map((c) => c.toLowerCase()))].slice(0, MAX_RECENT_COLORS) }
}

export type FolderKind = 'documents' | 'desktop' | 'downloads' | 'pictures' | 'other'

export interface FileLocation {
  filePath: string
  /** Name without extension. */
  fileName: string
  folderKind: FolderKind
  folderName: string
}

/** What "Öffnen" can bring back: a Pixel project or a plain image. */
export type OpenedFile =
  | { kind: 'project'; location: FileLocation | null; project: PixelProject }
  | { kind: 'image'; name: string; mime: 'image/png' | 'image/jpeg'; bytes: Uint8Array }

export type OpenError = 'not-a-pixel-file' | 'newer-version' | 'damaged' | 'not-found' | 'not-allowed' | 'unsupported'

export type OpenResult = { ok: true; opened: OpenedFile } | { ok: false; canceled: true } | { ok: false; error: OpenError }

export interface SaveProjectRequest {
  project: PixelProject
  filePath: string | null
  saveAs: boolean
  suggestedName: string
}

export type SaveResult = { ok: true; location: FileLocation } | { ok: false; canceled: true } | { ok: false; error: 'write-failed' | 'not-allowed' }

export interface ExportImageRequest {
  format: 'png' | 'jpg'
  bytes: Uint8Array
  suggestedName: string
}

export interface SnapshotRequest {
  docId: string
  project: PixelProject
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

export interface AppInfo {
  version: string
  platform: string
}
