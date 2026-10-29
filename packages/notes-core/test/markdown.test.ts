import { describe, expect, it } from 'vitest'
import {
  attachmentFileName,
  attachmentRefs,
  rebaseAttachmentRefs,
  attachmentUrlFromFile,
  attachmentUrlToFile,
  cleanRelativePath,
  findWikiLinks,
  ftsQuery,
  linkKeys,
  markdownToHtml,
  markdownToPlain,
  mayDeleteForGood,
  openLinkQuery,
  parseNote,
  renameWikiLinks,
  safeName,
  serializeNote,
  toMarkdown,
  trashDaysLeft,
  type JsonNode
} from '../src'

const defaults = { title: 'Datei', created: '2026-01-01T00:00:00.000Z', modified: '2026-01-02T00:00:00.000Z' }
const text = (value: string, marks?: JsonNode['marks']): JsonNode => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })
const p = (...content: JsonNode[]): JsonNode => ({ type: 'paragraph', content })
const doc = (...content: JsonNode[]): JsonNode => ({ type: 'doc', content })

describe('note header (front matter)', () => {
  it('writes and reads all fields', () => {
    const file = serializeNote({
      meta: {
        title: 'Einkauf: Wochenende',
        tags: ['Haushalt', '#wichtig', 'haushalt'],
        created: '2026-10-29T10:00:00.000Z',
        modified: '2026-10-29T11:00:00.000Z',
        pinned: true,
        color: 'gelb',
        deleted: null,
        original: null,
        extra: ['aliases: [Einkauf]']
      },
      body: '- [ ] Milch\n'
    })
    expect(file).toBe(
      '---\ntitle: "Einkauf: Wochenende"\ntags: [haushalt, wichtig]\ncreated: 2026-10-29T10:00:00.000Z\nmodified: 2026-10-29T11:00:00.000Z\npinned: true\ncolor: gelb\naliases: [Einkauf]\n---\n- [ ] Milch\n'
    )
    const note = parseNote(file, defaults)
    expect(note.meta).toMatchObject({ title: 'Einkauf: Wochenende', tags: ['haushalt', 'wichtig'], pinned: true, color: 'gelb', extra: ['aliases: [Einkauf]'] })
    expect(note.body).toBe('- [ ] Milch\n')
    expect(serializeNote(note)).toBe(file)
  })

  it('uses file name and file dates when there is no header', () => {
    const note = parseNote('# Hallo\r\nWelt', defaults)
    expect(note.meta.title).toBe('Datei')
    expect(note.meta.created).toBe(defaults.created)
    expect(note.body).toBe('# Hallo\nWelt')
  })

  it('reads block lists, quotes and broken values safely', () => {
    const note = parseNote('---\ntitle: \'It\'\'s\'\ntags:\n  - eins\n  - "zwei drei"\ncreated: kaputt\ncolor: neon\n---\nText', defaults)
    expect(note.meta.title).toBe("It's")
    expect(note.meta.tags).toEqual(['eins', 'zwei-drei'])
    expect(note.meta.created).toBe(defaults.created)
    expect(note.meta.color).toBeNull()
  })

  it('treats a lone --- line as text, not as a header', () => {
    expect(parseNote('---\nkein Ende', defaults).body).toBe('---\nkein Ende')
  })
})

describe('editor content -> Markdown', () => {
  it('writes headings, marks, links and escapes special characters', () => {
    const md = toMarkdown(
      doc(
        { type: 'heading', attrs: { level: 2 }, content: [text('Plan')] },
        p(text('Das ist '), text('fett ', [{ type: 'bold' }]), text('und '), text('kursiv', [{ type: 'italic' }]), text(' mit '), text('Link', [{ type: 'link', attrs: { href: 'https://dulidan.de' } }])),
        p(text('5 * 3 = 15, a_b, _x_ und `code`')),
        p(text('# keine Überschrift')),
        p(text('Code: '), text('npm `run`', [{ type: 'code' }]))
      )
    )
    expect(md).toBe(
      '## Plan\n\nDas ist **fett** und *kursiv* mit [Link](https://dulidan.de)\n\n5 \\* 3 = 15, a_b, \\_x\\_ und \\`code\\`\n\n\\# keine Überschrift\n\nCode: `` npm `run` ``\n'
    )
  })

  it('writes lists, checklists, quotes, code blocks and tables', () => {
    const md = toMarkdown(
      doc(
        { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('eins'))] }, { type: 'listItem', content: [p(text('zwei')), { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('unter'))] }] }] }] },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(text('erledigt'))] }, { type: 'taskItem', attrs: { checked: false }, content: [p(text('offen'))] }] },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p(text('drei'))] }] },
        { type: 'blockquote', content: [p(text('Zitat')), p(text('zweiter Absatz'))] },
        { type: 'codeBlock', attrs: { language: 'js' }, content: [text('const a = 1 * 2')] },
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableHeader', content: [p(text('Name'))] }, { type: 'tableHeader', content: [p(text('Preis'))] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', content: [p(text('Milch | Bio'))] }, { type: 'tableCell', content: [p(text('1,29'))] }] }
          ]
        }
      )
    )
    expect(md).toBe(
      [
        '- eins',
        '- zwei',
        '  - unter',
        '',
        '- [x] erledigt',
        '- [ ] offen',
        '',
        '3. drei',
        '',
        '> Zitat',
        '>',
        '> zweiter Absatz',
        '',
        '```js',
        'const a = 1 * 2',
        '```',
        '',
        '| Name | Preis |',
        '| --- | --- |',
        '| Milch \\| Bio | 1,29 |',
        ''
      ].join('\n')
    )
  })

  it('writes images with and without size, with paths relative to the note', () => {
    const md = toMarkdown(
      doc(p({ type: 'image', attrs: { src: 'cortex://attachments/a.png', alt: 'Foto' } }), p({ type: 'image', attrs: { src: 'cortex://attachments/b.png', alt: '', width: 300 } })),
      { imageSrc: (src) => attachmentUrlToFile(src, 'Rezepte/Kuchen.md') }
    )
    expect(md).toBe('![Foto](../attachments/a.png)\n\n<img src="../attachments/b.png" alt="" width="300">\n')
  })

  it('keeps [[links]] and keeps two lists apart', () => {
    const md = toMarkdown(
      doc(p(text('Siehe [[Rezepte]]')), { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('a'))] }] }, { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('b'))] }] })
    )
    expect(md).toBe('Siehe [[Rezepte]]\n\n- a\n\n<!-- -->\n\n- b\n')
  })
})

describe('Markdown -> editor HTML', () => {
  it('turns checklists into the editor form', () => {
    const html = markdownToHtml('- [x] **erledigt**\n- [ ] offen\n')
    expect(html).toContain('<ul data-type="taskList">')
    expect(html).toContain('<li data-type="taskItem" data-checked="true"><p><strong>erledigt</strong></p></li>')
    expect(html).toContain('<li data-type="taskItem" data-checked="false"><p>offen</p></li>')
  })

  it('changes image addresses, also in HTML image lines', () => {
    const resolve = (src: string): string => attachmentUrlFromFile(src, 'Rezepte/Kuchen.md')
    const html = markdownToHtml('![Foto](../attachments/a.png)\n\n<img src="../attachments/b.png" width="300">\n', { imageSrc: resolve })
    expect(html).toContain('<img src="cortex://attachments/a.png" alt="Foto">')
    expect(html).toContain('<img src="cortex://attachments/b.png" width="300">')
  })

  it('round trip: what the serializer writes, marked reads back', () => {
    const html = markdownToHtml('5 \\* 3 und a_b und \\_x\\_\n\n| A | B |\n| --- | --- |\n| 1 \\| 2 | x |\n')
    expect(html).toContain('5 * 3 und a_b und _x_')
    expect(html).toContain('<td>1 | 2</td>')
  })

  it('plain text, checklist count and first image for the index', () => {
    const plain = markdownToPlain('# Kuchen\n\n![Bild](attachments/k.png)\n\n- [x] Mehl\n- [ ] **Zucker**\n\nSiehe [[Backen]] & mehr.')
    expect(plain).toEqual({ text: 'Kuchen Bild Mehl Zucker Siehe [[Backen]] & mehr.', tasksDone: 1, tasksTotal: 2, firstImage: 'attachments/k.png' })
  })
})

describe('names, links, search words, trash rules', () => {
  it('makes safe file names', () => {
    expect(safeName('Brief: an "Oma"?')).toBe('Brief an Oma')
    expect(safeName('  ...  ')).toBe('Unbenannt')
    expect(safeName('CON')).toBe('CON_')
    expect(cleanRelativePath('a/../b')).toBeNull()
    expect(cleanRelativePath('.papierkorb/x.md')).toBeNull()
    expect(cleanRelativePath('Arbeit\\Kunden/x.md')).toBe('Arbeit/Kunden/x.md')
  })

  it('finds, renames and suggests [[links]]', () => {
    const body = 'Siehe [[Rezepte]], [[rezepte|hier]] und `[[kein Link]]`\n\n```\n[[auch nicht]]\n```'
    expect(findWikiLinks(body)).toEqual([
      { target: 'Rezepte', label: null },
      { target: 'rezepte', label: 'hier' }
    ])
    expect(linkKeys(body)).toEqual(['rezepte'])
    expect(renameWikiLinks(body, 'REZEPTE', 'Backrezepte')).toContain('[[Backrezepte]], [[Backrezepte|hier]]')
    expect(openLinkQuery('Text [[Kuc')).toBe('Kuc')
    expect(openLinkQuery('Text [[Kuchen]] weiter')).toBeNull()
  })

  it('builds safe search queries', () => {
    expect(ftsQuery('Kuch "NEAR( äpfel')).toBe('"Kuch"* "NEAR"* "äpfel"*')
    expect(ftsQuery(' -- ')).toBeNull()
  })

  it('keeps notes 30 days in the trash', () => {
    const deleted = '2026-10-01T12:00:00.000Z'
    expect(trashDaysLeft(deleted, Date.parse('2026-10-02T12:00:00.000Z'))).toBe(29)
    expect(mayDeleteForGood(deleted, Date.parse('2026-10-30T12:00:00.000Z'))).toBe(false)
    expect(mayDeleteForGood(deleted, Date.parse('2026-10-31T12:00:00.000Z'))).toBe(true)
  })

  it('moves picture and file links with the note', () => {
    const body = '![a](attachments/a.png) [Rechnung](attachments/r.pdf) [Web](https://x.de/attachments/y) <img src="attachments/b.png" width="9">'
    const moved = rebaseAttachmentRefs(body, 'Notiz.md', 'Arbeit/Kunden/Notiz.md')
    expect(moved).toBe('![a](../../attachments/a.png) [Rechnung](../../attachments/r.pdf) [Web](https://x.de/attachments/y) <img src="../../attachments/b.png" width="9">')
    expect(rebaseAttachmentRefs(moved, 'Arbeit/Kunden/Notiz.md', 'Notiz.md')).toBe(body)
    expect(attachmentRefs(moved, 'Arbeit/Kunden/Notiz.md')).toEqual(['a.png', 'r.pdf', 'b.png'])
  })

  it('names attachments safely', () => {
    expect(attachmentFileName('Urlaub Foto (1).JPG', new Date('2026-10-29T17:15:01Z'), 'a3f9')).toBe('urlaub-foto-1-20261029-171501-a3f9.jpg')
    expect(attachmentUrlFromFile('https://x.de/a.png', 'a.md')).toBe('https://x.de/a.png')
    expect(attachmentUrlFromFile('../../attachments/a.png', 'a.md')).toBe('../../attachments/a.png')
  })
})
