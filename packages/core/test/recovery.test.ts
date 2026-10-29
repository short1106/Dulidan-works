import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isSafeId, snapshotDate, snapshotId, snapshotsToDelete } from '../src/recovery'
import { atomicWriteFile } from '../src/node/atomicWrite'
import { SnapshotStore } from '../src/node/snapshotStore'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'glyph-test-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('recovery rules', () => {
  it('builds sortable snapshot ids and reads the date back', () => {
    const date = new Date('2026-10-29T08:15:30.123Z')
    const id = snapshotId(date)
    expect(isSafeId(id)).toBe(true)
    expect(snapshotDate(id).toISOString()).toBe(date.toISOString())
    expect(snapshotId(date, 2) > id).toBe(true)
  })

  it('keeps only the newest snapshots', () => {
    const ids = Array.from({ length: 13 }, (_, i) => snapshotId(new Date(Date.UTC(2026, 0, 1, 0, 0, i))))
    expect(snapshotsToDelete(ids, 10)).toEqual(ids.slice(0, 3).reverse())
  })

  it('rejects ids that could escape the folder', () => {
    expect(isSafeId('../etc')).toBe(false)
    expect(isSafeId('a/b')).toBe(false)
    expect(isSafeId('')).toBe(false)
  })
})

describe('atomicWriteFile', () => {
  it('replaces the file and leaves no temp files behind', async () => {
    const file = join(dir, 'brief.glyph')
    await writeFile(file, 'alt')
    await atomicWriteFile(file, 'neu')
    expect(await readFile(file, 'utf8')).toBe('neu')
    expect(await readdir(dir)).toEqual(['brief.glyph'])
  })

  it('keeps the old file when writing fails', async () => {
    const file = join(dir, 'brief.glyph')
    await writeFile(file, 'alt')
    // Writing a non-buffer object fails inside writeFile.
    await expect(atomicWriteFile(file, { broken: true } as unknown as string)).rejects.toThrow()
    expect(await readFile(file, 'utf8')).toBe('alt')
    expect(await readdir(dir)).toEqual(['brief.glyph'])
  })
})

describe('SnapshotStore', () => {
  const meta = { title: 'Brief', filePath: null, unsaved: true }

  it('keeps the last ten snapshots per document', async () => {
    const store = new SnapshotStore(dir)
    await store.beginSession()
    for (let i = 0; i < 13; i++) await store.save('doc-1', new Uint8Array([i]), meta)
    const list = await store.list('doc-1')
    expect(list).toHaveLength(10)
    // newest first, and it is the last one written
    expect(Array.from(await store.read('doc-1', list[0]!.id))).toEqual([12])
  })

  it('detects a crash and keeps unsaved documents', async () => {
    const first = new SnapshotStore(dir)
    expect(await first.beginSession()).toBe(true)
    await first.save('doc-1', new Uint8Array([1]), meta)
    await first.save('doc-2', new Uint8Array([2]), { ...meta, title: 'Gespeichert', unsaved: false })
    // No endSession: the app "crashed".

    const second = new SnapshotStore(dir)
    expect(await second.beginSession()).toBe(false)
    const docs = await second.listDocuments()
    expect(docs.map((d) => d.docId).sort()).toEqual(['doc-1', 'doc-2'])
    expect(docs.find((d) => d.docId === 'doc-1')?.unsaved).toBe(true)
  })

  it('cleans up saved documents on a normal exit', async () => {
    const store = new SnapshotStore(dir)
    await store.beginSession()
    await store.save('doc-1', new Uint8Array([1]), meta)
    await store.save('doc-2', new Uint8Array([2]), meta)
    await store.markSaved('doc-2', 'Brief', '/home/brief.glyph')
    await store.endSession()

    const next = new SnapshotStore(dir)
    expect(await next.beginSession()).toBe(true)
    expect((await next.listDocuments()).map((d) => d.docId)).toEqual(['doc-1'])
  })

  it('refuses unsafe ids', async () => {
    const store = new SnapshotStore(dir)
    await expect(store.save('../evil', new Uint8Array([1]), meta)).rejects.toThrow()
    await expect(store.read('doc-1', '../../x')).rejects.toThrow()
  })
})
