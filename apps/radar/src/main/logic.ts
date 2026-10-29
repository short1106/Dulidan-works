/**
 * Pure rules of Radar: finding e-mail addresses on a website, the blocklist,
 * the daily limit and the pauses between mails. No network, no files, so they
 * can be tested directly.
 */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

/** Addresses that belong to tools, images or example texts, never to a business. */
const JUNK_PARTS = ['example.', 'sentry', 'wixpress', 'domain.', 'yourdomain', '.png', '.jpg', '.webp', '.svg', 'noreply', 'no-reply']

/** Business categories and words that do not fit a Zimmerei search (from the Akquise tool). */
export const EXCLUDED_NAME_WORDS = ['Immobilien', 'Praxis', 'Therap', 'Heilprakt', 'Psycholog', 'Versicherung', 'Hausverwaltung', 'Physio', 'Fußpflege', 'Podo', 'Medien', 'Transporte']

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** All plausible e-mail addresses in a page, without duplicates, in order of appearance. */
export function extractEmails(page: string): string[] {
  const decoded = decodeHtmlEntities(page)
  const found: string[] = []
  for (const match of decoded.matchAll(EMAIL)) {
    const address = normalizeEmail(match[0])
    if (JUNK_PARTS.some((part) => address.includes(part))) continue
    if (!found.includes(address)) found.push(address)
  }
  return found
}

/** Picks the best address: one on the company's own domain first, then the usual contact names. */
export function pickEmail(candidates: string[], websiteHost: string): string | null {
  if (candidates.length === 0) return null
  const host = websiteHost.replace(/^www\./, '').toLowerCase()
  const own = candidates.filter((address) => address.endsWith('@' + host) || address.endsWith('.' + host))
  const pool = own.length > 0 ? own : candidates
  const preferred = ['info@', 'kontakt@', 'office@', 'mail@', 'hallo@']
  for (const prefix of preferred) {
    const hit = pool.find((address) => address.startsWith(prefix))
    if (hit) return hit
  }
  return pool[0]
}

/** Is this address or its whole domain on the blocklist? Lines starting with "@" block a domain. */
export function isBlocked(address: string, blocklist: string[]): boolean {
  const target = normalizeEmail(address)
  const domain = target.slice(target.indexOf('@'))
  return blocklist.some((entry) => {
    const item = normalizeEmail(entry)
    if (!item || item.startsWith('#')) return false
    return item.startsWith('@') ? item === domain : item === target
  })
}

/** Does the name show that the company is from another field (e.g. "Immobilien Hofmann")? */
export function isForeignBusiness(name: string, excludedWords: string[] = EXCLUDED_NAME_WORDS): boolean {
  const lower = name.toLowerCase()
  return excludedWords.some((word) => lower.includes(word.toLowerCase()))
}

/** How many mails may still be sent today. */
export function remainingToday(limit: number, sentToday: number): number {
  return Math.max(0, limit - sentToday)
}

/** A random pause in milliseconds between min and max seconds, so mails do not go out in a rhythm. */
export function pauseMs(minSeconds: number, maxSeconds: number, random: () => number = Math.random): number {
  const low = Math.min(minSeconds, maxSeconds)
  const high = Math.max(minSeconds, maxSeconds)
  return Math.round((low + random() * (high - low)) * 1000)
}

/** Local calendar day as YYYY-MM-DD, used to reset the daily counter. */
export function dayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Greeting for a contact person, or the fallback when no name is known. */
export function greeting(contactName: string | null, fallback: string): string {
  const name = (contactName ?? '').trim()
  if (!name) return fallback
  const parts = name.split(/\s+/)
  const last = parts[parts.length - 1]
  return `Sehr geehrte/r ${parts.length > 1 ? last : name},`
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/\s*(?:&#64;|&commat;|\[at\]|\(at\))\s*/gi, '@')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
}
