import type { Settings } from '@dulidan/core'
import type {
  AppInfo,
  CortexPrefs,
  FolderInfo,
  NoteColor,
  NoteSummary,
  OpenedNote,
  RecoveredNote,
  Result,
  SavedInfo,
  SearchHit,
  SyncResult,
  TrashEntry,
  VaultInfo
} from '../shared/ipc'

export interface ListFilter {
  folder?: string | null
  tag?: string | null
  pinnedOnly?: boolean
}

export interface CortexApi {
  settings: {
    get(): Promise<Settings>
    update(patch: Partial<Settings>): Promise<Settings>
  }
  prefs: {
    get(): Promise<CortexPrefs>
    update(patch: Partial<CortexPrefs>): Promise<CortexPrefs>
  }
  app: { info(): Promise<AppInfo> }
  vault: {
    info(): Promise<VaultInfo>
    /** Asks for a new notes folder; null if the user cancels. */
    choose(): Promise<VaultInfo | null>
    openInExplorer(): Promise<void>
    rebuildIndex(): Promise<number>
  }
  notes: {
    list(filter?: ListFilter): Promise<NoteSummary[]>
    search(query: string, filter?: ListFilter): Promise<SearchHit[]>
    load(path: string): Promise<Result<OpenedNote>>
    create(input: { folder?: string; title?: string; color?: NoteColor | null; body?: string }): Promise<Result<OpenedNote>>
    save(path: string, body: string, expectedMtime: number): Promise<Result<SavedInfo>>
    rename(path: string, title: string): Promise<Result<OpenedNote & { updatedLinks: number }>>
    move(path: string, folder: string): Promise<Result<string>>
    pin(path: string, pinned: boolean): Promise<Result<SavedInfo>>
    color(path: string, color: NoteColor | null): Promise<Result<SavedInfo>>
    setTags(path: string, tags: string[]): Promise<Result<SavedInfo>>
    trash(path: string): Promise<Result<string>>
    backlinks(path: string): Promise<NoteSummary[]>
    resolveLink(title: string): Promise<string | null>
    suggest(text: string): Promise<Array<{ path: string; title: string }>>
    tags(): Promise<Array<{ tag: string; count: number }>>
  }
  folders: {
    list(): Promise<FolderInfo>
    create(parent: string, name: string): Promise<Result<string>>
    rename(path: string, name: string): Promise<Result<string>>
    remove(path: string): Promise<Result<void>>
  }
  trash: {
    list(): Promise<TrashEntry[]>
    restore(path: string): Promise<Result<string>>
    deleteForGood(path: string): Promise<Result<void>>
    load(path: string): Promise<Result<OpenedNote>>
  }
  attachments: {
    /** Stores a picture or file; returns its name in the attachments folder. */
    save(bytes: Uint8Array, name: string): Promise<Result<string>>
    open(name: string): Promise<Result<void>>
  }
  /** Opens a web or mail address in the browser / mail program (after the window asked). */
  openLink(url: string): Promise<void>
  exports: {
    pdf(title: string): Promise<Result<string | null>>
    markdown(path: string): Promise<Result<string | null>>
    /** Asks for Markdown/text files and imports them; returns the new note paths. */
    importFiles(folder: string): Promise<Result<string[]>>
  }
  recovery: {
    put(path: string, title: string, body: string): Promise<void>
    drop(path: string): Promise<void>
    list(): Promise<RecoveredNote[]>
    discard(id: string): Promise<void>
  }
  quickNote: {
    save(title: string, body: string): Promise<Result<string>>
    close(): Promise<void>
  }
  window: {
    setDirty(dirty: boolean): void
    closeConfirmed(): void
  }
  events: {
    onNotesChanged(callback: (result: SyncResult) => void): () => void
    onVaultChanged(callback: () => void): () => void
    onCloseRequested(callback: () => void): () => void
    onOpenNote(callback: (path: string) => void): () => void
  }
}

declare global {
  interface Window {
    cortex: CortexApi
  }
}
