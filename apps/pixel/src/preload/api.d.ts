import type {
  AppInfo,
  ExportImageRequest,
  OpenResult,
  PixelPrefs,
  RecoverableEntry,
  SaveProjectRequest,
  SaveResult,
  Settings,
  SnapshotRequest
} from '../shared/ipc'

/** Everything the Pixel window may ask the system for, as `window.pixel`. */
export interface PixelApi {
  appInfo(): Promise<AppInfo>

  settings: {
    get(): Promise<Settings>
    update(patch: Partial<Settings>): Promise<Settings>
  }

  prefs: {
    get(): Promise<PixelPrefs>
    update(patch: Partial<PixelPrefs>): Promise<PixelPrefs>
  }

  file: {
    /** Open dialog for projects (.pixel) and images (PNG, JPG). */
    openDialog(): Promise<OpenResult>
    /** Opens a file from the recent list. */
    openPath(filePath: string): Promise<OpenResult>
    saveProject(request: SaveProjectRequest): Promise<SaveResult>
    /** "Als Bild speichern": PNG or JPG. */
    exportImage(request: ExportImageRequest): Promise<SaveResult>
    takeLaunchFile(): Promise<OpenResult | null>
    onOpenRequested(listener: (result: OpenResult) => void): () => void
    showInFolder(filePath: string): Promise<void>
  }

  recovery: {
    check(): Promise<RecoverableEntry[]>
    snapshot(request: SnapshotRequest): Promise<void>
    markSaved(docId: string, title: string, filePath: string | null): Promise<void>
    load(docId: string): Promise<OpenResult>
    discard(docId: string): Promise<void>
  }

  window: {
    setDirty(dirty: boolean): void
    onCloseRequested(listener: () => void): () => void
    confirmClose(): void
  }
}

declare global {
  interface Window {
    pixel: PixelApi
  }
}
