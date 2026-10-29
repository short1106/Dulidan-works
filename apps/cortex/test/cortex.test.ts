import { describe, expect, it } from 'vitest'
import { MODES } from '@dulidan/core'
import { NOTE_COLORS, plainTextToMarkdown } from '@dulidan/notes-core'
import { normalizePrefs } from '../src/shared/ipc'
import { cardColor } from '../src/renderer/src/cards'
import { editorToMarkdown, noteToEditorHtml } from '../src/renderer/src/editor/markdown'
import { can, FEATURES, type FeatureId } from '../src/renderer/src/features'

describe('modes', () => {
  it('basic mode: cards, new note, search, checklist, picture, trash; no folders, tags or links', () => {
    for (const feature of ['newNote', 'search', 'checklist', 'image', 'trash', 'pin'] as FeatureId[]) expect(can(feature, 'basic')).toBe(true)
    for (const feature of ['folders', 'tags', 'links', 'backlinks', 'tables', 'attachments', 'exportPdf', 'import', 'quickNote', 'april'] as FeatureId[]) {
      expect(can(feature, 'basic')).toBe(false)
    }
  })

  it('expert mode has everything except April; pro adds the April placeholder', () => {
    const all = Object.keys(FEATURES) as FeatureId[]
    expect(all.filter((feature) => !can(feature, 'expert'))).toEqual(['april'])
    expect(all.filter((feature) => !can(feature, 'pro'))).toEqual([])
  })

  it('every mode has a defined set of features', () => {
    for (const mode of MODES) expect(Object.values(FEATURES).some((feature) => (feature.modes as readonly string[]).includes(mode))).toBe(true)
  })
})

describe('Markdown bridge of the editor', () => {
  it('shows pictures through cortex:// and writes them back relative to the note', () => {
    const html = noteToEditorHtml('![Kuchen](../attachments/kuchen.png)\n\n[Rechnung](../attachments/r.pdf)', 'Rezepte/Kuchen.md')
    expect(html).toContain('src="cortex://attachments/kuchen.png"')
    expect(html).toContain('href="cortex://attachments/r.pdf"')
    const md = editorToMarkdown(
      {
        type: 'doc',
        content: [
          { type: 'image', attrs: { src: 'cortex://attachments/kuchen.png', alt: 'Kuchen', width: 240 } },
          { type: 'paragraph', content: [{ type: 'text', text: 'Rechnung', marks: [{ type: 'link', attrs: { href: 'cortex://attachments/r.pdf' } }] }] }
        ]
      },
      'Rezepte/Kuchen.md'
    )
    expect(md).toBe('<img src="../attachments/kuchen.png" alt="Kuchen" width="240">\n\n[Rechnung](../attachments/r.pdf)\n')
  })

  it('a checklist survives the way file -> editor -> file', () => {
    const html = noteToEditorHtml('- [x] Milch\n- [ ] Brot\n', 'Einkauf.md')
    expect(html).toContain('data-checked="true"')
    const md = editorToMarkdown(
      {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Milch' }] }] },
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Brot' }] }] }
            ]
          }
        ]
      },
      'Einkauf.md'
    )
    expect(md).toBe('- [x] Milch\n- [ ] Brot\n')
  })
})

describe('quick note, cards, preferences', () => {
  it('turns typed text into Markdown without accidental formatting', () => {
    expect(plainTextToMarkdown('Zahnarzt anrufen\n# 3 Uhr *wichtig*\n\n- nicht vergessen')).toBe('Zahnarzt anrufen\\\n\\# 3 Uhr \\*wichtig\\*\n\n\\- nicht vergessen')
  })

  it('gives notes without a color a fixed card color', () => {
    const color = cardColor({ path: 'Ideen.md', color: null })
    expect(NOTE_COLORS).toContain(color)
    expect(cardColor({ path: 'Ideen.md', color: null })).toBe(color)
    expect(cardColor({ path: 'Ideen.md', color: 'blau' })).toBe('blau')
  })

  it('reads broken preference files safely', () => {
    expect(normalizePrefs({ notesDir: 42, layout: 'gitter' })).toEqual({ notesDir: null, layout: 'list' })
    expect(normalizePrefs({ notesDir: 'C:\\Notizen', layout: 'cards' })).toEqual({ notesDir: 'C:\\Notizen', layout: 'cards' })
  })
})
