import { describe, expect, it } from 'vitest'
import { listPlaceholders, renderTemplate } from '../src/templates'

const template = {
  subject: 'Hallo {{name}}, ein Vorschlag für {{ Betrieb }}',
  body: '<p>Guten Tag {{name}},</p><p>hier die Demo: <a href="{{demo_link}}">{{demo_link}}</a></p>'
}

describe('templates', () => {
  it('fills placeholders, case-insensitive', () => {
    const result = renderTemplate(template, { name: 'Frau Schmidt', betrieb: 'Tischlerei Holz & Co', demo_link: 'https://dulidan.de/demo' })
    expect(result.subject).toBe('Hallo Frau Schmidt, ein Vorschlag für Tischlerei Holz & Co')
    expect(result.body).toContain('Guten Tag Frau Schmidt,')
    expect(result.body).toContain('href="https://dulidan.de/demo"')
    expect(result.missing).toEqual([])
  })

  it('escapes values in the HTML body, never in the subject', () => {
    const result = renderTemplate({ subject: '{{name}}', body: '{{name}}' }, { name: '<b>Max</b> & "Co"' })
    expect(result.body).toBe('&lt;b&gt;Max&lt;/b&gt; &amp; &quot;Co&quot;')
    expect(result.subject).toBe('<b>Max</b> & "Co"')
  })

  it('reports missing values or throws in strict mode', () => {
    const result = renderTemplate(template, { name: 'Max' })
    expect(result.missing).toEqual(['betrieb', 'demo_link'])
    expect(() => renderTemplate(template, { name: 'Max' }, { strict: true })).toThrow(/betrieb/)
  })

  it('lists the placeholders of a template', () => {
    expect(listPlaceholders(template.subject + template.body)).toEqual(['name', 'betrieb', 'demo_link'])
  })
})
