import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JsonFile } from '../src/node/jsonFile'
import { normalizeSettings } from '../src/settings'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dulidan-json-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('JsonFile', () => {
  it('starts with defaults and survives broken files', async () => {
    const file = join(dir, 'settings.json')
    await writeFile(file, '{ broken')
    const settings = new JsonFile(file, normalizeSettings)
    expect((await settings.load()).mode).toBeNull()
  })

  it('stores updates and reads them back', async () => {
    const file = join(dir, 'settings.json')
    await new JsonFile(file, normalizeSettings).update({ mode: 'expert' })
    expect(JSON.parse(await readFile(file, 'utf8')).mode).toBe('expert')
    expect((await new JsonFile(file, normalizeSettings).load()).mode).toBe('expert')
  })
})
