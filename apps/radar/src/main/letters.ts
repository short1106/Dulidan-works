import type { Lead } from './leads'
import { OPT_OUT_OPEN, renderLeadMail, type RadarTemplate } from './templates'

/**
 * Letters on paper for companies without a mail address (or by choice):
 * the same text as the mail, laid out as a German business letter
 * (DIN 5008, form B): sender line and address field for a window envelope,
 * date on the right, subject in bold. One page per company.
 */

export interface LetterSender {
  name: string
  /** Postal address, one line per row, e.g. "Hauptstraße 1\n74613 Öhringen". */
  address: string
  email: string
}

/** The mail hint ("antworten Sie mit Abmelden") does not fit on paper. */
export const LETTER_OPT_OUT =
  'Ihre Anschrift stammt aus einem öffentlichen Branchenverzeichnis. Wenn Sie keine weitere Post von mir möchten, geben Sie mir bitte kurz Bescheid.'

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** "Hauptstraße 5, 74613 Öhringen, Deutschland" -> ["Hauptstraße 5", "74613 Öhringen"]. */
export function addressLines(address: string): string[] {
  return address
    .split(/\s*[,\n]\s*/)
    .map((line) => line.trim())
    .filter((line) => line && !/^(deutschland|germany)$/i.test(line))
}

export function letterDate(date: Date, place: string): string {
  const day = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(date)
  return place ? `${place}, ${day}` : day
}

/** Town of the sender, taken from the last address line ("74613 Öhringen" -> "Öhringen"). */
export function senderTown(address: string): string {
  const last = addressLines(address).at(-1) ?? ''
  return last.replace(/^\d{4,5}\s+/, '')
}

export function letterText(template: RadarTemplate, lead: Pick<Lead, 'name'>): { subject: string; body: string } {
  const { mail } = renderLeadMail(template, null, lead.name)
  return { subject: mail.subject, body: mail.body.replace(OPT_OUT_OPEN, LETTER_OPT_OUT) }
}

/** A complete HTML page with one letter per printed page. */
export function lettersHtml(leads: Array<Pick<Lead, 'name' | 'address'>>, template: RadarTemplate, sender: LetterSender, date: Date): string {
  const senderLines = [sender.name, ...addressLines(sender.address)]
  const senderLine = senderLines.join(' · ')
  const dateText = letterDate(date, senderTown(sender.address))
  const pages = leads.map((lead) => {
    const { subject, body } = letterText(template, lead)
    const recipient = [lead.name, ...addressLines(lead.address)].map((line) => `<div>${escape(line)}</div>`).join('')
    const paragraphs = body
      .split(/\n\s*\n/)
      .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('')
    return `<section class="letter">
  <div class="top"><header class="sender">${senderLines.map((line) => `<div>${escape(line)}</div>`).join('')}${sender.email ? `<div>${escape(sender.email)}</div>` : ''}</header></div>
  <div class="window"><div class="return">${escape(senderLine)}</div><div class="recipient">${recipient}</div></div>
  <div class="date">${escape(dateText)}</div>
  <h1 class="subject">${escape(subject)}</h1>
  <div class="body">${paragraphs}</div>
</section>`
  })
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Briefe</title><style>
@page { size: A4; margin: 15mm 20mm 18mm 20mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.4; color: #111; }
/* Each letter starts on a new page; a long text simply continues on the next one. */
.letter { break-after: page; }
.letter:last-child { break-after: auto; }
/* DIN 5008 form B: address field 45 mm from the top edge, 20 mm from the left edge. */
.top { height: 30mm; position: relative; }
.sender { position: absolute; top: 0; right: 0; text-align: right; font-size: 9pt; color: #333; }
.window { height: 45mm; width: 85mm; }
/* The text itself starts 25 mm from the left edge, the address field 20 mm. */
.date, .subject, .body { margin-left: 5mm; }
.return { font-size: 7pt; color: #555; border-bottom: 0.3pt solid #999; padding-bottom: 1mm; margin-bottom: 3mm; white-space: nowrap; overflow: hidden; }
.date { margin-top: 8mm; text-align: right; }
.subject { margin: 6mm 0 6mm 5mm; font-size: 10.5pt; font-weight: bold; }
.body p { margin: 0 0 3mm; break-inside: avoid; }
</style></head><body>${pages.join('\n')}</body></html>`
}
