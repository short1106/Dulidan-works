/**
 * Messages between the Prism window and the main process.
 * Only plain data crosses the bridge.
 */
import type { Settings } from '@dulidan/core'
import type { Deck } from '../main/deck'

export type { Deck }

export interface OpenedDeck {
  deck: Deck
  path: string
}

export interface PrismApi {
  appInfo: () => Promise<{ name: string; version: string }>
  settings: {
    get: () => Promise<Settings>
    update: (patch: Partial<Settings>) => Promise<Settings>
  }
  file: {
    open: () => Promise<OpenedDeck | null>
    /** Saves to `path`, or asks for a place when `path` is null. Returns the path or null if cancelled. */
    save: (deck: Deck, path: string | null) => Promise<string | null>
  }
  recovery: {
    save: (deck: Deck) => Promise<void>
    load: () => Promise<Deck | null>
    discard: () => Promise<void>
  }
  pdf: { export: (suggestedName: string) => Promise<string | null> }
}

export const IPC = {
  appInfo: 'prism:app-info',
  settingsGet: 'prism:settings-get',
  settingsUpdate: 'prism:settings-update',
  fileOpen: 'prism:file-open',
  fileSave: 'prism:file-save',
  recoverySave: 'prism:recovery-save',
  recoveryLoad: 'prism:recovery-load',
  recoveryDiscard: 'prism:recovery-discard',
  pdfExport: 'prism:pdf-export'
} as const
