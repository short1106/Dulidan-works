import type { Address, MessageDetail } from '../../../shared/ipc'
import { escapeText } from './sanitize'

export type ComposeKind = 'new' | 'reply' | 'replyAll' | 'forward'

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' })

export function formatMailDate(ms: number): string {
  return dateFormat.format(new Date(ms))
}

/** "Re: " or "Fwd: " in front, but never twice. */
export function prefixSubject(subject: string, prefix: 'Re: ' | 'Fwd: '): string {
  const clean = subject.trim()
  const pattern = prefix === 'Re: ' ? /^(re|aw|antw)\s*:/i : /^(fwd?|wg|weitergeleitet)\s*:/i
  return pattern.test(clean) ? clean : `${prefix}${clean}`
}

/**
 * Who gets a reply. "Antworten": the sender (or Reply-To). "Allen antworten":
 * also all other recipients, but never the own address.
 */
export function replyRecipients(mail: Pick<MessageDetail, 'from' | 'replyTo' | 'to' | 'cc'>, ownAddresses: string[], all: boolean): { to: Address[]; cc: Address[] } {
  const own = new Set(ownAddresses.map((address) => address.toLowerCase()))
  const seen = new Set<string>()
  const take = (list: Address[]): Address[] =>
    list.filter((entry) => {
      const key = entry.address.toLowerCase()
      if (own.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
  const primary = mail.replyTo.length > 0 ? mail.replyTo : mail.from ? [mail.from] : []
  const to = take(primary)
  if (!all) return { to, cc: [] }
  return { to: [...to, ...take(mail.to)], cc: take(mail.cc) }
}

/** The quoted original below a reply or forward, as HTML. */
export function quoteOriginal(mail: Pick<MessageDetail, 'from' | 'to' | 'date' | 'subject' | 'text' | 'html'>, kind: ComposeKind, labels: { quoteHeader: (date: string, name: string) => string; forwardHeader: string }, safeHtml: string | null): string {
  const sender = mail.from ? (mail.from.name ? `${mail.from.name} <${mail.from.address}>` : mail.from.address) : ''
  const body = safeHtml ?? `<p>${escapeText(mail.text).replace(/\n/g, '<br>')}</p>`
  if (kind === 'forward') {
    const header = [
      labels.forwardHeader,
      `Von: ${sender}`,
      `Datum: ${formatMailDate(mail.date)}`,
      `Betreff: ${mail.subject}`,
      `An: ${mail.to.map((entry) => entry.address).join(', ')}`
    ]
      .map(escapeText)
      .join('<br>')
    return `<p></p><p>${header}</p>${body}`
  }
  return `<p></p><p>${escapeText(labels.quoteHeader(formatMailDate(mail.date), sender))}</p><blockquote>${body}</blockquote>`
}

/** Signature as simple HTML: text lines, escaped. */
export function signatureToHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return `<p>--<br>${escapeText(trimmed).replace(/\n/g, '<br>')}</p>`
}

/** References for a reply: those of the original plus its own Message-ID. */
export function replyReferences(mail: Pick<MessageDetail, 'messageId' | 'references'>): string[] {
  return [...mail.references, ...(mail.messageId ? [mail.messageId] : [])].slice(-20)
}
