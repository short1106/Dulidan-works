import { randomUUID } from 'node:crypto'
import { JsonFile } from '@dulidan/core/node'
import { extractEmails, isBlocked, isForeignBusiness, pickEmail, dayKey } from './logic'

export type LeadStatus = 'neu' | 'kontaktiert' | 'antwort' | 'kein_interesse'

export interface Lead {
  id: string
  name: string
  branche: string
  address: string
  phone: string | null
  website: string | null
  email: string | null
  /** Set when the website was checked, even if no address was found. */
  checkedAt: number | null
  status: LeadStatus
  note: string
  contactedAt: number | null
  createdAt: number
}

export interface RadarData {
  leads: Lead[]
  blocklist: string[]
  /** Mails sent on the day in `sentDay`. The counter resets on a new day. */
  sentDay: string
  sentToday: number
}

const EMPTY: RadarData = { leads: [], blocklist: [], sentDay: '', sentToday: 0 }

export function normalizeData(raw: unknown): RadarData {
  const input = (raw ?? {}) as Partial<RadarData>
  return {
    leads: Array.isArray(input.leads) ? input.leads.filter(isLead) : [],
    blocklist: Array.isArray(input.blocklist) ? input.blocklist.filter((item): item is string => typeof item === 'string') : [],
    sentDay: typeof input.sentDay === 'string' ? input.sentDay : EMPTY.sentDay,
    sentToday: typeof input.sentToday === 'number' && Number.isFinite(input.sentToday) ? input.sentToday : 0
  }
}

function isLead(value: unknown): value is Lead {
  return typeof value === 'object' && value !== null && typeof (value as Lead).id === 'string' && typeof (value as Lead).name === 'string'
}

/** Keeps all lead data in one small JSON file, written safely (see atomicWriteFile). */
export class RadarStore {
  private readonly file: JsonFile<RadarData>

  constructor(path: string) {
    this.file = new JsonFile<RadarData>(path, normalizeData)
  }

  async load(): Promise<void> {
    await this.file.load()
  }

  data(): RadarData {
    return this.file.get()
  }

  leads(): Lead[] {
    return this.data().leads
  }

  async addLeads(found: Array<Pick<Lead, 'name' | 'branche' | 'address' | 'phone' | 'website'>>): Promise<number> {
    const existing = new Set(this.leads().map((lead) => lead.name.toLowerCase() + '|' + lead.address.toLowerCase()))
    const fresh: Lead[] = []
    for (const item of found) {
      const key = item.name.toLowerCase() + '|' + item.address.toLowerCase()
      if (existing.has(key) || isForeignBusiness(item.name)) continue
      existing.add(key)
      fresh.push({ ...item, id: randomUUID(), email: null, checkedAt: null, status: 'neu', note: '', contactedAt: null, createdAt: Date.now() })
    }
    await this.file.update({ leads: [...this.leads(), ...fresh] })
    return fresh.length
  }

  async updateLead(id: string, patch: Partial<Pick<Lead, 'status' | 'note' | 'email' | 'checkedAt'>>): Promise<void> {
    const leads = this.leads().map((lead) => (lead.id === id ? { ...lead, ...patch } : lead))
    await this.file.update({ leads })
  }

  async removeLead(id: string): Promise<void> {
    await this.file.update({ leads: this.leads().filter((lead) => lead.id !== id) })
  }

  async setBlocklist(entries: string[]): Promise<void> {
    await this.file.update({ blocklist: entries.map((entry) => entry.trim()).filter(Boolean) })
  }

  isBlocked(address: string): boolean {
    return isBlocked(address, this.data().blocklist)
  }

  /** Mails already sent today (resets automatically on a new day). */
  sentToday(now: Date = new Date()): number {
    return this.data().sentDay === dayKey(now) ? this.data().sentToday : 0
  }

  async countSent(now: Date = new Date()): Promise<void> {
    const today = dayKey(now)
    const count = this.sentToday(now) + 1
    await this.file.update({ sentDay: today, sentToday: count })
  }
}

export interface PlaceResult {
  name: string
  branche: string
  address: string
  phone: string | null
  website: string | null
}

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'

/**
 * Searches Google Places with the user's own API key. This is the only network
 * call of a search. The key is sent only to Google.
 */
export async function searchPlaces(apiKey: string, branche: string, ort: string, max = 20): Promise<PlaceResult[]> {
  const response = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber'
    },
    body: JSON.stringify({ textQuery: `${branche} in ${ort}`, languageCode: 'de', regionCode: 'DE', maxResultCount: max }),
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) throw new Error(`Google Places antwortet mit ${response.status}`)
  const body = (await response.json()) as { places?: Array<Record<string, unknown>> }
  return (body.places ?? []).map((place) => ({
    name: textOf(place['displayName']) || 'Ohne Name',
    branche,
    address: typeof place['formattedAddress'] === 'string' ? place['formattedAddress'] : '',
    phone: typeof place['nationalPhoneNumber'] === 'string' ? place['nationalPhoneNumber'] : null,
    website: typeof place['websiteUri'] === 'string' ? place['websiteUri'] : null
  }))
}

function textOf(value: unknown): string {
  if (typeof value === 'object' && value !== null && typeof (value as { text?: unknown }).text === 'string') {
    return (value as { text: string }).text
  }
  return ''
}

/**
 * Looks at the home page and the imprint/contact page of a company and
 * returns the best e-mail address found, or null.
 */
export async function findEmailOnWebsite(website: string): Promise<string | null> {
  let base: URL
  try {
    base = new URL(website.startsWith('http') ? website : 'https://' + website)
  } catch {
    return null
  }
  const pages = [base.toString(), new URL('/impressum', base).toString(), new URL('/kontakt', base).toString()]
  const candidates: string[] = []
  for (const url of pages) {
    const html = await fetchText(url)
    if (html) candidates.push(...extractEmails(html))
  }
  return pickEmail([...new Set(candidates)], base.hostname)
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Dulidan Radar)', Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000)
    })
    if (!response.ok) return null
    const text = await response.text()
    return text.slice(0, 1_000_000)
  } catch {
    return null
  }
}
