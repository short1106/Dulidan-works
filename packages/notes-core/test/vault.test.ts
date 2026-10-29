import { mkdtemp, readdir, readFile, rm, unlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NotesService, Vault, VaultError } from '../src/node'

let dir: string
let notes: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cortex-test-'))
  notes = join(dir, 'Notizen')
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('Vault: notes as Markdown files', () => {
  it('creates, saves and loads a note as a readable Markdown file', async () => {
    const vault = new Vault(notes)
    await vault.ensure()
    const created = await vault.create({ title: 'Einkauf', body: '- [ ] Milch\n', color: 'gelb' }, new Date('2026-10-29T10:00:00Z'))
    expect(created.path).toBe('Einkauf.md')
    const file = await readFile(join(notes, 'Einkauf.md'), 'utf8')
    expect(file).toBe('---\ntitle: Einkauf\ncreated: 2026-10-29T10:00:00.000Z\nmodified: 2026-10-29T10:00:00.000Z\ncolor: gelb\n---\n- [ ] Milch\n')
    const loaded = await vault.read('Einkauf.md')
    expect(loaded.note.body).toBe('- [ ] Milch\n')
    // No temporary files are left behind (atomic saving).
    expect(await readdir(notes)).toEqual(['Einkauf.md'])
  })

  it('numbers notes with the same title and refuses paths outside', async () => {
    const vault = new Vault(notes)
    await vault.ensure()
    expect((await vault.create()).path).toBe('Unbenannt.md')
    const second = await vault.create()
    expect(second.path).toBe('Unbenannt 2.md')
    expect(second.note.meta.title).toBe('Unbenannt 2')
    await expect(vault.read('../geheim.md')).rejects.toBeInstanceOf(VaultError)
    await expect(vault.create({ folder: '.papierkorb' })).rejects.toBeInstanceOf(VaultError)
  })

  it('renames the file with the title, also when only the case changes', async () => {
    const vault = new Vault(notes)
    await vault.ensure()
    await vault.create({ title: 'notiz', body: 'Inhalt' })
    const renamed = await vault.rename('notiz.md', 'Notiz')
    expect(renamed.path).toBe('Notiz.md')
    expect((await vault.read('Notiz.md')).note.body).toBe('Inhalt\n')
    const other = await vault.rename('Notiz.md', 'Andere: Notiz')
    expect(other.path).toBe('Andere Notiz.md')
    expect(other.note.meta.title).toBe('Andere: Notiz')
    expect((await vault.listNotes()).map((note) => note.path)).toEqual(['Andere Notiz.md'])
  })

  it('folders: create, move into, rename, remove only when empty', async () => {
    const vault = new Vault(notes)
    await vault.ensure()
    await vault.createFolder('', 'Arbeit')
    await vault.createFolder('Arbeit', 'Kunden')
    const note = await vault.create({ title: 'Angebot' })
    const moved = await vault.move(note.path, 'Arbeit/Kunden')
    expect(moved).toBe('Arbeit/Kunden/Angebot.md')
    expect(await vault.listFolders()).toEqual(['Arbeit', 'Arbeit/Kunden'])
    await expect(vault.removeFolder('Arbeit')).rejects.toMatchObject({ code: 'folder-not-empty' })
    expect(await vault.renameFolder('Arbeit', 'Büro')).toBe('Büro')
    await vault.move('Büro/Kunden/Angebot.md', '')
    await vault.removeFolder('Büro')
    expect(await vault.listFolders()).toEqual([])
  })

  it('trash: keeps the note 30 days, restores it to its folder', async () => {
    const vault = new Vault(notes)
    await vault.ensure()
    await vault.create({ folder: 'Privat', title: 'Tagebuch', body: 'Geheim' })
    const trashed = await vault.trash('Privat/Tagebuch.md', new Date('2026-10-01T12:00:00Z'))
    expect(trashed).toBe('.papierkorb/Tagebuch.md')
    expect(await vault.listNotes()).toEqual([])
    const [entry] = await vault.listTrash(Date.parse('2026-10-11T12:00:00Z'))
    expect(entry).toMatchObject({ title: 'Tagebuch', original: 'Privat/Tagebuch.md', daysLeft: 20 })

    await expect(vault.deleteForGood(trashed, Date.parse('2026-10-20T12:00:00Z'))).rejects.toMatchObject({ code: 'too-early' })
    const restored = await vault.restore(trashed)
    expect(restored).toBe('Privat/Tagebuch.md')
    const back = await vault.read(restored)
    expect(back.note.body).toBe('Geheim\n')
    expect(back.note.meta.deleted).toBeNull()
    expect(await readFile(join(notes, restored), 'utf8')).not.toContain('original:')

    const again = await vault.trash(restored, new Date('2026-10-01T12:00:00Z'))
    await vault.deleteForGood(again, Date.parse('2026-11-01T12:00:00Z'))
    expect(await vault.listTrash()).toEqual([])
  })

  it('stores attachments with safe names', async () => {
    const vault = new Vault(notes)
    await vault.ensure()
    const name = await vault.saveAttachment(new Uint8Array([1, 2, 3]), 'Mein Bild.PNG')
    expect(name).toMatch(/^mein-bild-\d{8}-\d{6}-[0-9a-f]{4}\.png$/)
    expect([...(await readFile(vault.attachmentFile(name)!))]).toEqual([1, 2, 3])
    expect(vault.attachmentFile('../x.png')).toBeNull()
  })
})

describe('NotesService: index, search, links', () => {
  const open = (watch = false): Promise<NotesService> => NotesService.open({ root: notes, indexFile: join(dir, 'index.sqlite'), watch })

  it('finds notes by title and text, with umlauts and word beginnings', async () => {
    const service = await open()
    await service.create({ title: 'Apfelkuchen', body: 'Rezept von Oma mit Äpfeln und Zimt.' })
    await service.create({ title: 'Einkauf', body: '- [ ] Äpfel\n- [ ] Mehl' })
    await service.create({ title: 'Urlaub', body: 'Nichts mit Kuchen hier? Doch: Kuchen am Strand.' })
    // "kuch" finds words starting with it ("Kuchen"), not word middles ("Apfelkuchen").
    expect(service.search('kuch').map((hit) => hit.title)).toEqual(['Urlaub'])
    expect(service.search('Apfelkuchen').map((hit) => hit.title)).toEqual(['Apfelkuchen'])
    expect(service.search('apfel').map((hit) => hit.title).sort()).toEqual(['Apfelkuchen', 'Einkauf'])
    expect(service.search('äpfel mehl').map((hit) => hit.title)).toEqual(['Einkauf'])
    expect(service.search('strand')[0]!.snippet).toContain('\u0001Strand\u0002')
    expect(service.search('')).toEqual([])
    service.close()
  })

  it('rebuilds the index from the files at any time', async () => {
    let service = await open()
    await service.create({ title: 'Eins', body: 'Hallo [[Zwei]]', tags: ['test'] })
    await service.create({ title: 'Zwei', body: 'Welt' })
    service.close()
    await unlink(join(dir, 'index.sqlite'))
    service = await open()
    expect(service.list().map((note) => note.title).sort()).toEqual(['Eins', 'Zwei'])
    expect(service.tags()).toEqual([{ tag: 'test', count: 1 }])
    expect(await service.rebuildIndex()).toBe(2)
    expect(service.backlinks('Zwei.md').map((note) => note.title)).toEqual(['Eins'])
    service.close()
  })

  it('notices files changed, added and removed outside Cortex', async () => {
    const service = await open()
    await service.create({ title: 'Extern', body: 'alt' })
    await writeFile(join(notes, 'Extern.md'), '---\ntitle: Extern\n---\nneuer Text von außen\n')
    await utimes(join(notes, 'Extern.md'), new Date(), new Date(Date.now() + 5000))
    await writeFile(join(notes, 'Neu ohne Kopf.md'), 'Nur Text')
    const result = await service.syncNow()
    expect(result.changed.sort()).toEqual(['Extern.md', 'Neu ohne Kopf.md'])
    expect(service.search('außen').map((hit) => hit.path)).toEqual(['Extern.md'])
    expect(service.list().find((note) => note.path === 'Neu ohne Kopf.md')?.title).toBe('Neu ohne Kopf')
    await unlink(join(notes, 'Extern.md'))
    expect((await service.syncNow()).removed).toEqual(['Extern.md'])
    service.close()
  })

  it('watches the folder and reports outside changes by itself', async () => {
    const service = await open(true)
    const changed = new Promise<string[]>((resolve) => service.once('changed', (result) => resolve(result.changed)))
    await writeFile(join(notes, 'Von außen.md'), 'Hallo')
    expect(await changed).toEqual(['Von außen.md'])
    service.close()
  })

  it('links and back links; renaming updates [[links]] in other notes', async () => {
    const service = await open()
    await service.create({ title: 'Rezepte', body: 'Sammlung' })
    await service.create({ title: 'Kuchen', body: 'Aus [[Rezepte]] und [[rezepte|der Sammlung]]' })
    await service.create({ folder: 'Arbeit', title: 'Kantine', body: 'Siehe [[Rezepte]]' })
    expect(service.backlinks('Rezepte.md').map((note) => note.title).sort()).toEqual(['Kantine', 'Kuchen'])
    expect(service.resolveLink('REZEPTE')).toBe('Rezepte.md')
    expect(service.suggest('ezep').map((item) => item.title)).toEqual(['Rezepte'])
    expect(service.suggest('Ku').map((item) => item.title)).toEqual(['Kuchen'])

    const renamed = await service.rename('Rezepte.md', 'Backrezepte')
    expect(renamed.path).toBe('Backrezepte.md')
    expect(renamed.updatedLinks).toBe(2)
    expect((await service.load('Kuchen.md')).note.body).toBe('Aus [[Backrezepte]] und [[Backrezepte|der Sammlung]]\n')
    expect(service.backlinks('Backrezepte.md').map((note) => note.title).sort()).toEqual(['Kantine', 'Kuchen'])
    service.close()
  })

  it('saves with conflict check, pins, tags and the trash keep the index right', async () => {
    const service = await open()
    const note = await service.create({ title: 'Plan', body: 'v1' })
    const saved = await service.save(note.path, { body: 'v2 mit Wort', expectedMtime: note.mtimeMs })
    await expect(service.save(note.path, { body: 'v3', expectedMtime: note.mtimeMs - 10_000 })).rejects.toMatchObject({ code: 'conflict' })
    await service.save(note.path, { body: 'v3', expectedMtime: saved.mtimeMs })
    await service.setPinned(note.path, true)
    await service.setTags(note.path, ['Wichtig', 'Arbeit'])
    await service.create({ title: 'Später', body: 'x' })
    expect(service.list().map((n) => n.title)).toEqual(['Plan', 'Später'])
    expect(service.list({ tag: 'wichtig' }).map((n) => n.title)).toEqual(['Plan'])
    const trashed = await service.moveToTrash(note.path)
    expect(service.search('v3')).toEqual([])
    expect((await service.trash()).map((entry) => entry.title)).toEqual(['Plan'])
    await service.restore(trashed)
    expect(service.search('v3').map((hit) => hit.title)).toEqual(['Plan'])
    service.close()
  })

  it('imports Markdown and text files, exports Markdown with pictures', async () => {
    const service = await open()
    const source = join(dir, 'import')
    await rm(source, { recursive: true, force: true })
    await import('node:fs/promises').then((fs) => fs.mkdir(join(source, 'bilder'), { recursive: true }))
    await writeFile(join(source, 'bilder', 'foto.png'), new Uint8Array([137, 80, 78, 71]))
    await writeFile(join(source, 'Reise.md'), '---\ntitle: Reise nach Rom\ntags: [urlaub]\n---\n# Rom\n\n![Foto](bilder/foto.png)\n')
    await writeFile(join(source, 'Liste.txt'), 'Zeile 1\nZeile *2*\n\nNeuer Absatz')
    const created = await service.importFiles([join(source, 'Reise.md'), join(source, 'Liste.txt'), join(source, 'bild.exe')], 'Import')
    expect(created).toEqual(['Import/Reise nach Rom.md', 'Import/Liste.md'])
    const reise = await service.load('Import/Reise nach Rom.md')
    expect(reise.note.meta.tags).toEqual(['urlaub'])
    expect(reise.note.body).toMatch(/!\[Foto\]\(\.\.\/attachments\/foto-\d{8}-\d{6}-[0-9a-f]{4}\.png\)/)
    expect((await service.load('Import/Liste.md')).note.body).toBe('Zeile 1\\\nZeile \\*2\\*\n\nNeuer Absatz\n')

    // Moving the note to the top folder changes "../attachments/" into "attachments/".
    const moved = await service.move('Import/Reise nach Rom.md', '')
    expect((await service.load(moved)).note.body).toMatch(/\]\(attachments\/foto-/)
    await service.move(moved, 'Import')
    const target = join(dir, 'export', 'Rom.md')
    await import('node:fs/promises').then((fs) => fs.mkdir(join(dir, 'export'), { recursive: true }))
    await service.exportMarkdown('Import/Reise nach Rom.md', target)
    const exported = await readFile(target, 'utf8')
    expect(exported).toMatch(/!\[Foto\]\(attachments\/foto-.*\.png\)/)
    expect(await readdir(join(dir, 'export', 'attachments'))).toHaveLength(1)
    service.close()
  })

  it('stays fast with thousands of notes', async () => {
    const vault = new Vault(notes)
    await vault.ensure()
    for (let i = 0; i < 2000; i++) {
      await writeFile(join(notes, `Notiz ${i}.md`), `---\ntitle: Notiz ${i}\n---\nText Nummer ${i} über ${i % 7 === 0 ? 'Gartenarbeit' : 'Alltag'} und mehr.\n`)
    }
    const startOpen = performance.now()
    const service = await open()
    const openMs = performance.now() - startOpen
    const startSearch = performance.now()
    const hits = service.search('garten')
    const searchMs = performance.now() - startSearch
    // 286 notes match; the list shows the best 200.
    expect(hits).toHaveLength(200)
    expect(searchMs).toBeLessThan(150)
    const resyncStart = performance.now()
    await service.syncNow()
    expect(performance.now() - resyncStart).toBeLessThan(2000)
    expect(openMs).toBeLessThan(20_000)
    service.close()
  }, 60_000)
})
