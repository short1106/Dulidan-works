import { describe, expect, it } from 'vitest'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { parsePixel, PIXEL_FORMAT_VERSION, PixelFormatError, serializePixel, type PixelProject } from '../src/pixelFormat'

const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0)
)

function sampleProject(): PixelProject {
  return {
    width: 640,
    height: 480,
    activeLayerId: 'b',
    createdAt: '2026-01-01T10:00:00.000Z',
    modifiedAt: '2026-01-02T10:00:00.000Z',
    layers: [
      { id: 'a', name: 'Hintergrund', visible: true, opacity: 1, png: PNG },
      { id: 'b', name: 'Skizze', visible: false, opacity: 0.5, png: PNG }
    ]
  }
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(PixelFormatError)
    expect((error as PixelFormatError).code).toBe(code)
    return
  }
  throw new Error('expected a PixelFormatError')
}

describe('.pixel format', () => {
  it('saves and loads a project without changes', () => {
    const project = sampleProject()
    expect(parsePixel(serializePixel(project, '0.1.0'))).toEqual(project)
  })

  it('stores one PNG per layer, in order', () => {
    const entries = unzipSync(serializePixel(sampleProject(), '0.1.0'))
    expect(Object.keys(entries)[0]).toBe('mimetype')
    expect(Object.keys(entries).filter((name) => name.startsWith('layers/'))).toEqual(['layers/layer-1.png', 'layers/layer-2.png'])
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']))
    expect(manifest).toMatchObject({ format: 'dulidan-pixel', formatVersion: PIXEL_FORMAT_VERSION, width: 640, height: 480 })
  })

  it('refuses other files', () => {
    expectCode(() => parsePixel(strToU8('hello')), 'not-a-pixel-file')
    expectCode(() => parsePixel(zipSync({ 'a.txt': strToU8('x') })), 'not-a-pixel-file')
  })

  it('refuses newer versions', () => {
    const entries = unzipSync(serializePixel(sampleProject(), '0.1.0'))
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']))
    manifest.formatVersion = PIXEL_FORMAT_VERSION + 1
    entries['manifest.json'] = strToU8(JSON.stringify(manifest))
    expectCode(() => parsePixel(zipSync(entries)), 'newer-version')
  })

  it('reports missing layer images and bad sizes as damaged', () => {
    const entries = unzipSync(serializePixel(sampleProject(), '0.1.0'))
    delete entries['layers/layer-2.png']
    expectCode(() => parsePixel(zipSync(entries)), 'damaged')

    const big = unzipSync(serializePixel(sampleProject(), '0.1.0'))
    const manifest = JSON.parse(new TextDecoder().decode(big['manifest.json']))
    manifest.width = 100000
    big['manifest.json'] = strToU8(JSON.stringify(manifest))
    expectCode(() => parsePixel(zipSync(big)), 'damaged')
  })

  it('falls back to the top layer if the active layer is unknown', () => {
    const project = { ...sampleProject(), activeLayerId: 'gone' }
    expect(parsePixel(serializePixel(project, '0.1.0')).activeLayerId).toBe('b')
  })
})
