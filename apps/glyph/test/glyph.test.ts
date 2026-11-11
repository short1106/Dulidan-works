import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { Node } from '@tiptap/pm/model'
import { isAvailableIn, MODES, parseGlyph, serializeGlyph, type GlyphDocument } from '@dulidan/core'
import { ACTIONS, BASIC_TOOLBAR, type ActionId } from '../src/renderer/src/actions'
import { createExtensions } from '../src/renderer/src/editor/extensions'

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

/** A letter with everything Glyph can do: formats, list, table, picture. */
const letter = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Brief an Oma' }] },
    {
      type: 'paragraph',
      attrs: { textAlign: 'left' },
      content: [
        { type: 'text', text: 'Liebe Oma, ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'danke' },
        { type: 'text', text: ' für ' },
        { type: 'text', marks: [{ type: 'textStyle', attrs: { color: '#c62828', fontFamily: 'serif', fontSize: '16pt' } }], text: 'alles' }
      ]
    },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Kuchen' }] }] }] },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tag' }] }] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sonntag' }] }] }] }
      ]
    },
    { type: 'image', attrs: { src: PIXEL, alt: 'Foto', width: 120 } }
  ]
}

describe('Glyph documents', () => {
  const schema = getSchema(createExtensions())

  it('the test letter is valid for the Glyph editor', () => {
    expect(() => Node.fromJSON(schema, letter).check()).not.toThrow()
  })

  it('saves and loads a .glyph file without losing anything', () => {
    const doc: GlyphDocument = { content: letter as GlyphDocument['content'], createdAt: '2026-11-04T10:00:00.000Z', modifiedAt: '2026-11-04T11:00:00.000Z' }
    const loaded = parseGlyph(serializeGlyph(doc, '1.0.0'))
    expect(loaded).toEqual(doc)
    // What comes back fits the editor again, so the user sees exactly the same letter.
    expect(Node.fromJSON(schema, loaded.content).eq(Node.fromJSON(schema, letter))).toBe(true)
  })

  it('refuses files that are not Glyph documents', () => {
    expect(() => parseGlyph(new TextEncoder().encode('kein zip'))).toThrow()
  })
})

describe('Glyph modes', () => {
  it('basic mode has exactly ten big buttons, all usable in basic mode', () => {
    expect(BASIC_TOOLBAR).toHaveLength(10)
    for (const id of BASIC_TOOLBAR) expect(isAvailableIn(ACTIONS[id], 'basic')).toBe(true)
  })

  it('tables and "Speichern unter" are only in expert and pro', () => {
    for (const id of ['table', 'saveAs'] as ActionId[]) {
      expect(isAvailableIn(ACTIONS[id], 'basic')).toBe(false)
      expect(isAvailableIn(ACTIONS[id], 'expert')).toBe(true)
      expect(isAvailableIn(ACTIONS[id], 'pro')).toBe(true)
    }
  })

  it('expert and pro offer the same actions (pro only adds April)', () => {
    const ids = Object.keys(ACTIONS) as ActionId[]
    expect(ids.filter((id) => isAvailableIn(ACTIONS[id], 'expert'))).toEqual(ids.filter((id) => isAvailableIn(ACTIONS[id], 'pro')))
  })

  it('every action has a label, and no two share a keyboard shortcut', () => {
    const shortcuts = Object.values(ACTIONS)
      .map((action) => action.shortcut)
      .filter(Boolean)
    expect(new Set(shortcuts).size).toBe(shortcuts.length)
    for (const action of Object.values(ACTIONS)) expect(action.label.trim()).not.toBe('')
    for (const mode of MODES) expect(Object.values(ACTIONS).some((action) => isAvailableIn(action, mode))).toBe(true)
  })
})
