import type {
  AppInfo,
  ExportResult,
  OpenResult,
  RecoverableEntry,
  SaveRequest,
  SaveResult,
  Settings,
  SnapshotInfoLike,
  SnapshotRequest
} from '../shared/ipc'

/** Everything the window may ask the system for, as `window.glyph`. */
export interface GlyphApi {
  appInfo(): Promise<AppInfo>

  settings: {
    get(): Promise<Settings>
    update(patch: Partial<Settings>): Promise<Settings>
    /** Called when settings change, e.g. a new recent file. Returns an unsubscribe function. */
    onChange(listener: (settings: Settings) => void): () => void
  }

  file: {
    /** Shows the open dialog. */
    openDialog(): Promise<OpenResult>
    /** Opens a file from the recent list. */
    openPath(filePath: string): Promise<OpenResult>
    save(request: SaveRequest): Promise<SaveResult>
    /** A file passed at startup, e.g. by double-clicking a .glyph file. */
    takeLaunchFile(): Promise<OpenResult | null>
    /** A .glyph file was double-clicked while Glyph is already running. */
    onOpenRequested(listener: (result: OpenResult) => void): () => void
    showInFolder(filePath: string): Promise<void>
  }

  recovery: {
    /** Documents left unsaved by a crash, empty after a normal exit. */
    check(): Promise<RecoverableEntry[]>
    snapshot(request: SnapshotRequest): Promise<void>
    markSaved(docId: string, title: string, filePath: string | null): Promise<void>
    list(docId: string): Promise<SnapshotInfoLike[]>
    /** Loads a snapshot; without snapshotId the newest one. */
    load(docId: string, snapshotId?: string): Promise<OpenResult>
    discard(docId: string): Promise<void>
  }

  print: {
    exportPdf(suggestedName: string): Promise<ExportResult>
    print(): Promise<ExportResult>
  }

  window: {
    setDirty(dirty: boolean): void
    /** The user wants to close the window while there are unsaved changes. */
    onCloseRequested(listener: () => void): () => void
    confirmClose(): void
  }
}

declare global {
  interface Window {
    glyph: GlyphApi
  }
}
