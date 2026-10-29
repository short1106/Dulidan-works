import { join } from 'node:path'
import { app } from 'electron'
import { parsePixel, serializePixel } from '@dulidan/core'
import { SnapshotStore } from '@dulidan/core/node'
import type { OpenResult, RecoverableEntry, SnapshotRequest } from '../shared/ipc'
import { describeLocation, type FileService } from './files'

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

/** Autosave and crash recovery for Pixel projects (same store as Glyph). */
export class RecoveryService {
  private readonly store = new SnapshotStore(join(app.getPath('userData'), 'Wiederherstellung'))
  private pending: RecoverableEntry[] = []

  constructor(
    private readonly files: FileService,
    private readonly appVersion: string
  ) {}

  async start(): Promise<void> {
    await this.store.beginSession()
    await this.store.pruneOlderThan(THIRTY_DAYS)
    // Anything unsaved found now was left by a crash or not restored last time.
    this.pending = (await this.store.listDocuments())
      .filter((doc) => doc.unsaved)
      .map(({ docId, title, filePath, updatedAt }) => ({ docId, title, filePath, updatedAt }))
  }

  stop(): Promise<void> {
    return this.store.endSession()
  }

  takePending(): RecoverableEntry[] {
    const list = this.pending
    this.pending = []
    return list
  }

  async snapshot(request: SnapshotRequest): Promise<void> {
    await this.store.save(request.docId, serializePixel(request.project, this.appVersion), {
      title: request.title,
      filePath: request.filePath,
      unsaved: request.unsaved
    })
  }

  markSaved(docId: string, title: string, filePath: string | null): Promise<void> {
    return this.store.markSaved(docId, title, filePath)
  }

  async load(docId: string): Promise<OpenResult> {
    try {
      const latest = (await this.store.list(docId))[0]
      if (!latest) return { ok: false, error: 'not-found' }
      const project = parsePixel(await this.store.read(docId, latest.id))
      const meta = (await this.store.listDocuments()).find((doc) => doc.docId === docId)
      const filePath = meta?.filePath ?? null
      if (filePath) this.files.allow(filePath)
      return { ok: true, opened: { kind: 'project', location: filePath ? describeLocation(filePath) : null, project } }
    } catch {
      return { ok: false, error: 'damaged' }
    }
  }

  discard(docId: string): Promise<void> {
    return this.store.removeDocument(docId)
  }
}
