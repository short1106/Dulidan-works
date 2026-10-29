/**
 * Messages between the Cortex window and the main process.
 * Types come from notes-core (type-only imports).
 */
import type { NoteColor, NoteMeta, NoteSummary, TrashEntry } from '@dulidan/notes-core'
import type { SearchHit, SyncResult } from '@dulidan/notes-core/node'
import type { Settings } from '@dulidan/core'

export type { NoteColor, NoteMeta, NoteSummary, SearchHit, Settings, SyncResult, TrashEntry }

export type ListLayout = 'list' | 'cards'

/** Cortex preferences besides the shared settings. */
export interface CortexPrefs {
  /** The notes folder; null = default (Dokumente/Cortex). */
  notesDir: string | null
  /** List or cards in expert mode (basic mode always shows cards). */
  layout: ListLayout
}

export const DEFAULT_PREFS: CortexPrefs = { notesDir: null, layout: 'list' }

export function normalizePrefs(raw: unknown): CortexPrefs {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    notesDir: typeof input['notesDir'] === 'string' && input['notesDir'] ? input['notesDir'] : null,
    layout: input['layout'] === 'cards' ? 'cards' : 'list'
  }
}

export type ErrorCode = 'not-found' | 'invalid-path' | 'folder-not-empty' | 'exists' | 'too-early' | 'conflict' | 'too-big' | 'unknown'

export type Result<T> = { ok: true; value: T } | { ok: false; error: ErrorCode }

/** A note opened in the editor. */
export interface OpenedNote {
  path: string
  meta: NoteMeta
  body: string
  /** File time at loading; sent back when saving to notice outside changes. */
  mtimeMs: number
}

export interface SavedInfo {
  path: string
  mtimeMs: number
  modified: string
}

export interface FolderInfo {
  folders: string[]
  counts: Record<string, number>
}

export interface VaultInfo {
  /** Folder path as shown to the user. */
  root: string
  isDefault: boolean
  noteCount: number
}

/** Unsaved text found after Cortex did not close normally. */
export interface RecoveredNote {
  id: string
  path: string
  title: string
  body: string
  updatedAt: string
}

export interface AppInfo {
  version: string
  /** "Strg+Umschalt+Leertaste" or the Mac form. */
  quickNoteShortcut: string
  quickNoteActive: boolean
}

/** Channel names, in one place. */
export const IPC = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  prefsGet: 'prefs:get',
  prefsUpdate: 'prefs:update',
  appInfo: 'app:info',

  vaultInfo: 'vault:info',
  vaultChoose: 'vault:choose',
  vaultOpenInExplorer: 'vault:open-in-explorer',
  rebuildIndex: 'vault:rebuild-index',

  notesList: 'notes:list',
  notesSearch: 'notes:search',
  noteLoad: 'note:load',
  noteCreate: 'note:create',
  noteSave: 'note:save',
  noteRename: 'note:rename',
  noteMove: 'note:move',
  notePin: 'note:pin',
  noteColor: 'note:color',
  noteTags: 'note:tags',
  noteTrash: 'note:trash',
  backlinks: 'note:backlinks',
  resolveLink: 'note:resolve-link',
  suggest: 'note:suggest',
  tags: 'notes:tags',

  folders: 'folders:list',
  folderCreate: 'folder:create',
  folderRename: 'folder:rename',
  folderRemove: 'folder:remove',

  trashList: 'trash:list',
  trashRestore: 'trash:restore',
  trashDelete: 'trash:delete',
  trashLoad: 'trash:load',

  attachmentSave: 'attachment:save',
  attachmentOpen: 'attachment:open',
  openLink: 'link:open',

  exportPdf: 'export:pdf',
  exportMarkdown: 'export:markdown',
  importFiles: 'import:files',

  recoveryPut: 'recovery:put',
  recoveryDrop: 'recovery:drop',
  recoveryList: 'recovery:list',
  recoveryDiscard: 'recovery:discard',

  quickNoteSave: 'quick:save',
  quickNoteClose: 'quick:close',

  windowSetDirty: 'window:set-dirty',
  windowCloseConfirmed: 'window:close-confirmed',

  onNotesChanged: 'event:notes-changed',
  onVaultChanged: 'event:vault-changed',
  onCloseRequested: 'event:close-requested',
  onOpenNote: 'event:open-note'
} as const
