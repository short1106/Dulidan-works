import { describe, expect, it } from 'vitest'
import { strToU8, unzipSync, zipSync } from 'fflate'
import {
  countWords,
  createEmptyDocument,
  GLYPH_FORMAT_VERSION,
  GlyphFormatError,
  parseGlyph,
  serializeGlyph,
  type GlyphDocument
} from '../src/format'

// 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function sampleDocument(): GlyphDocument {
  return {
    createdAt: '2026-01-01T10:00:00.000Z',
    modifiedAt: '2026-01-02T10:00:00.000Z',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hallo Welt' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Ein fetter Satz.', marks: [{ type: 'bold' }] }]
        },
        { type: 'image', attrs: { src: PNG, width: 120 } },
        { type: 'image', attrs: { src: PNG } }
      ]
    }
  }
}

function expectFormatError(fn: () => unknown, code: string): void {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(GlyphFormatError)
    expect((error as GlyphFormatError).code).toBe(code)
    return
  }
  throw new Error('expected a GlyphFormatError')
}

describe('.glyph format', () => {
  it('saves and loads a document without changes', () => {
    const doc = sampleDocument()
    const loaded = parseGlyph(serializeGlyph(doc, '0.1.0'))
    expect(loaded).toEqual(doc)
  })

  it('stores images as separate files, identical images only once', () => {
    const entries = unzipSync(serializeGlyph(sampleDocument(), '0.1.0'))
    const images = Object.keys(entries).filter((name) => name.startsWith('images/'))
    expect(images).toEqual(['images/image-1.png'])
    const content = JSON.parse(new TextDecoder().decode(entries['document.json']))
    expect(content.content[2].attrs.src).toBe('images/image-1.png')
    expect(content.content[2].attrs.width).toBe(120)
  })

  it('writes mimetype first and a versioned manifest', () => {
    const entries = unzipSync(serializeGlyph(createEmptyDocument(), '1.2.3'))
    expect(Object.keys(entries)[0]).toBe('mimetype')
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']))
    expect(manifest).toMatchObject({ format: 'dulidan-glyph', formatVersion: GLYPH_FORMAT_VERSION, appVersion: '1.2.3' })
  })

  it('refuses files that are not ZIP archives', () => {
    expectFormatError(() => parseGlyph(strToU8('just some text')), 'not-a-glyph-file')
  })

  it('refuses ZIP archives that are not Glyph documents', () => {
    expectFormatError(() => parseGlyph(zipSync({ 'readme.txt': strToU8('hi') })), 'not-a-glyph-file')
  })

  it('refuses files from a newer Glyph version', () => {
    const entries = unzipSync(serializeGlyph(createEmptyDocument(), '0.1.0'))
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']))
    manifest.formatVersion = GLYPH_FORMAT_VERSION + 1
    entries['manifest.json'] = strToU8(JSON.stringify(manifest))
    expectFormatError(() => parseGlyph(zipSync(entries)), 'newer-version')
  })

  it('reports broken JSON as damaged', () => {
    const entries = unzipSync(serializeGlyph(createEmptyDocument(), '0.1.0'))
    entries['document.json'] = strToU8('{ not json')
    expectFormatError(() => parseGlyph(zipSync(entries)), 'damaged')
  })

  it('keeps the text when an image file is missing', () => {
    const entries = unzipSync(serializeGlyph(sampleDocument(), '0.1.0'))
    delete entries['images/image-1.png']
    const loaded = parseGlyph(zipSync(entries))
    expect(loaded.content.content?.[0]?.content?.[0]?.text).toBe('Hallo Welt')
    expect(loaded.content.content?.[2]?.attrs?.['src']).toBe('')
  })

  it('counts words', () => {
    expect(countWords(sampleDocument().content)).toBe(5)
  })
})
