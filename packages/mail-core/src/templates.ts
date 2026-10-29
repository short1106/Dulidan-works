/**
 * Mail templates with placeholders like {{name}}, {{betrieb}} or {{demo_link}}.
 * Used by Radar to turn one template into many personal mails.
 */

export interface MailTemplate {
  subject: string
  /** HTML body. */
  body: string
}

export interface RenderedMail {
  subject: string
  body: string
  /** Placeholders without a value. They are left empty in the result. */
  missing: string[]
}

const PLACEHOLDER = /\{\{\s*([\p{L}\p{N}_]+)\s*\}\}/gu

/** All placeholder names in a text, without duplicates, in order. */
export function listPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]!.toLowerCase()))]
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function fill(text: string, values: Record<string, string>, escape: boolean, missing: Set<string>): string {
  return text.replace(PLACEHOLDER, (_match, rawName: string) => {
    const name = rawName.toLowerCase()
    const value = values[name]
    if (value === undefined || value === '') {
      missing.add(name)
      return ''
    }
    // Values never become HTML: a name like "<b>Max</b>" is shown as written.
    return escape ? escapeHtml(value) : value.replace(/[\r\n]+/g, ' ')
  })
}

/**
 * Fills a template. Names are case-insensitive. With `strict`, a missing
 * value is an error instead of an empty spot.
 */
export function renderTemplate(template: MailTemplate, values: Record<string, string>, options: { strict?: boolean } = {}): RenderedMail {
  const normalized = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value ?? '')]))
  const missing = new Set<string>()
  const subject = fill(template.subject, normalized, false, missing)
  const body = fill(template.body, normalized, true, missing)
  if (options.strict && missing.size > 0) throw new Error(`Missing values: ${[...missing].join(', ')}`)
  return { subject, body, missing: [...missing] }
}
