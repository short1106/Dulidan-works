import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isSafeId, MAX_SNAPSHOTS, snapshotDate, snapshotId, snapshotsToDelete, type SnapshotInfo } from '../recovery'
import { atomicWriteFile } from './atomicWrite'

/** Extra information stored next to the snapshots of one document. */
export interface SnapshotMeta {
  /** Name shown to the user, e.g. "Brief an Oma" or "Unbenannt". */
  title: string
  /** File path if the document was saved before, otherwise null. */
  filePath: string | null
  /** True while the newest snapshot holds changes not saved by the user. */
  unsaved: boolean
  updatedAt: string
}

export interface RecoverableDocument extends SnapshotMeta {
  docId: string
  latestSnapshotId: string
}

const META_FILE = 'meta.json'
const LOCK_FILE = 'session.lock'
const SNAPSHOT_EXT = '.glyph'

/**
 * Stores automatic snapshots on disk:
 *
 *   <root>/session.lock              exists while the app runs
 *   <root>/<docId>/meta.json         title, path, unsaved flag
 *   <root>/<docId>/<snapshotId>.glyph
 *
 * If session.lock still exists on the next start, the app did not close
 * normally (crash, power loss) and unsaved documents can be restored.
 */
export class SnapshotStore {
  private lastId = ''

  constructor(
    private readonly root: string,
    private readonly keep = MAX_SNAPSHOTS
  ) {}

  private docDir(docId: string): string {
    if (!isSafeId(docId)) throw new Error(`Invalid document id: ${docId}`)
    return join(this.root, docId)
  }

  /** Call on start. Returns true if the previous session ended normally. */
  async beginSession(): Promise<boolean> {
    await mkdir(this.root, { recursive: true })
    const lock = join(this.root, LOCK_FILE)
    const crashed = await stat(lock).then(
      () => true,
      () => false
    )
    await writeFile(lock, new Date().toISOString())
    return !crashed
  }

  /** Call on a normal exit: removes the lock and recovery data of saved documents. */
  async endSession(): Promise<void> {
    for (const doc of await this.listDocuments()) {
      if (!doc.unsaved) await this.removeDocument(doc.docId)
    }
    await rm(join(this.root, LOCK_FILE), { force: true })
  }

  async save(docId: string, bytes: Uint8Array, meta: Omit<SnapshotMeta, 'updatedAt'>): Promise<SnapshotInfo> {
    const dir = this.docDir(docId)
    await mkdir(dir, { recursive: true })

    let id = snapshotId(new Date())
    for (let counter = 1; id <= this.lastId; counter++) id = snapshotId(new Date(), counter)
    this.lastId = id

    await atomicWriteFile(join(dir, id + SNAPSHOT_EXT), bytes)
    await this.writeMeta(docId, meta)

    const ids = await this.snapshotIds(docId)
    for (const old of snapshotsToDelete(ids, this.keep)) {
      await rm(join(dir, old + SNAPSHOT_EXT), { force: true })
    }
    return { id, savedAt: snapshotDate(id).toISOString(), size: bytes.byteLength }
  }

  /** Marks the document as saved by the user (e.g. after Speichern). */
  async markSaved(docId: string, title: string, filePath: string | null): Promise<void> {
    if (!(await this.hasDocument(docId))) return
    await this.writeMeta(docId, { title, filePath, unsaved: false })
  }

  /** Snapshots of one document, newest first. */
  async list(docId: string): Promise<SnapshotInfo[]> {
    const dir = this.docDir(docId)
    const ids = (await this.snapshotIds(docId)).sort().reverse()
    return Promise.all(
      ids.map(async (id) => ({
        id,
        savedAt: snapshotDate(id).toISOString(),
        size: (await stat(join(dir, id + SNAPSHOT_EXT))).size
      }))
    )
  }

  async read(docId: string, id: string): Promise<Uint8Array> {
    if (!isSafeId(id)) throw new Error(`Invalid snapshot id: ${id}`)
    return readFile(join(this.docDir(docId), id + SNAPSHOT_EXT))
  }

  async removeDocument(docId: string): Promise<void> {
    await rm(this.docDir(docId), { recursive: true, force: true })
  }

  /** All documents with snapshots, newest change first. */
  async listDocuments(): Promise<RecoverableDocument[]> {
    const entries = await readdir(this.root, { withFileTypes: true }).catch(() => [])
    const docs: RecoverableDocument[] = []
    for (const entry of entries) {
      if (!entry.isDirectory() || !isSafeId(entry.name)) continue
      const meta = await this.readMeta(entry.name)
      const ids = (await this.snapshotIds(entry.name)).sort()
      const latest = ids[ids.length - 1]
      if (!meta || !latest) {
        await this.removeDocument(entry.name)
        continue
      }
      docs.push({ ...meta, docId: entry.name, latestSnapshotId: latest })
    }
    return docs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  /** Removes recovery data older than the given age. */
  async pruneOlderThan(maxAgeMs: number, now = Date.now()): Promise<void> {
    for (const doc of await this.listDocuments()) {
      if (now - Date.parse(doc.updatedAt) > maxAgeMs) await this.removeDocument(doc.docId)
    }
  }

  private async hasDocument(docId: string): Promise<boolean> {
    return stat(this.docDir(docId)).then(
      () => true,
      () => false
    )
  }

  private async snapshotIds(docId: string): Promise<string[]> {
    const names = await readdir(this.docDir(docId)).catch(() => [] as string[])
    return names
      .filter((name) => name.endsWith(SNAPSHOT_EXT))
      .map((name) => name.slice(0, -SNAPSHOT_EXT.length))
      .filter(isSafeId)
  }

  private async writeMeta(docId: string, meta: Omit<SnapshotMeta, 'updatedAt'>): Promise<void> {
    const full: SnapshotMeta = { ...meta, updatedAt: new Date().toISOString() }
    await atomicWriteFile(join(this.docDir(docId), META_FILE), JSON.stringify(full, null, 2))
  }

  private async readMeta(docId: string): Promise<SnapshotMeta | null> {
    try {
      const raw = JSON.parse(await readFile(join(this.docDir(docId), META_FILE), 'utf8')) as Partial<SnapshotMeta>
      return {
        title: typeof raw.title === 'string' ? raw.title : '',
        filePath: typeof raw.filePath === 'string' ? raw.filePath : null,
        unsaved: raw.unsaved === true,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString()
      }
    } catch {
      return null
    }
  }
}
