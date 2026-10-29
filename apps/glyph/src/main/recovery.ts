import { join } from 'node:path'
import { app } from 'electron'
import { parseGlyph, serializeGlyph } from '@dulidan/core'
import { SnapshotStore } from '@dulidan/core/node'
import type { OpenResult, RecoverableEntry, SnapshotRequest } from '../shared/ipc'
import { describeLocation, type DocumentService } from './documents'

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

/**
 * Autosave and crash recovery. Snapshots live in the app data folder under
 * "Wiederherstellung" and never touch the user's own files.
 */
export class RecoveryService {
  private readonly store = new SnapshotStore(join(app.getPath('userData'), 'Wiederherstellung'))
  private crashed: RecoverableEntry[] = []

  constructor(
    private readonly documents: DocumentService,
    private readonly appVersion: string
  ) {}

  /** Call once on start, before any window asks for recovery data. */
  async start(): Promise<void> {
    await this.store.beginSession()
    await this.store.pruneOlderThan(THIRTY_DAYS)
    // After a normal exit nothing unsaved is left (the user chose "save" or
    // "don't save"). Anything unsaved found here was left by a crash or power
    // loss, or was not restored last time, so it is offered again.
    this.crashed = (await this.store.listDocuments())
      .filter((doc) => doc.unsaved)
      .map(({ docId, title, filePath, updatedAt }) => ({ docId, title, filePath, updatedAt }))
  }

  /** Call on a normal exit. */
  async stop(): Promise<void> {
    await this.store.endSession()
  }

  /** Unsaved documents from an earlier session. Answered only once per start. */
  takeCrashedDocuments(): RecoverableEntry[] {
    const list = this.crashed
    this.crashed = []
    return list
  }

  async snapshot(request: SnapshotRequest): Promise<void> {
    const bytes = serializeGlyph(request.document, this.appVersion)
    await this.store.save(request.docId, bytes, {
      title: request.title,
      filePath: request.filePath,
      unsaved: request.unsaved
    })
  }

  markSaved(docId: string, title: string, filePath: string | null): Promise<void> {
    return this.store.markSaved(docId, title, filePath)
  }

  list(docId: string) {
    return this.store.list(docId)
  }

  async load(docId: string, snapshotId?: string): Promise<OpenResult> {
    try {
      const id = snapshotId ?? (await this.store.list(docId))[0]?.id
      if (!id) return { ok: false, error: 'not-found' }
      const document = parseGlyph(await this.store.read(docId, id))
      const meta = (await this.store.listDocuments()).find((doc) => doc.docId === docId)
      const filePath = meta?.filePath ?? null
      // The recovered document may be saved to its old place again.
      if (filePath) this.documents.allow(filePath)
      return { ok: true, opened: { location: filePath ? describeLocation(filePath) : null, document } }
    } catch {
      return { ok: false, error: 'damaged' }
    }
  }

  discard(docId: string): Promise<void> {
    return this.store.removeDocument(docId)
  }
}
