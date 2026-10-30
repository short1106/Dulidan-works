/**
 * Ledger's rules: money in whole cents, VAT per rate, document numbers and the
 * checks a German invoice must pass (§ 14 UStG). No files, no network.
 */

export const VAT_RATES = [0, 7, 19] as const
export type VatRate = (typeof VAT_RATES)[number]

export interface Item {
  description: string
  /** May be fractional, e.g. 2.5 hours. */
  quantity: number
  unit: string
  /** Net price per unit in cents. */
  unitPriceCents: number
  vatRate: VatRate
}

export interface VatLine {
  rate: VatRate
  netCents: number
  vatCents: number
}

export interface Totals {
  netCents: number
  vat: VatLine[]
  vatCents: number
  grossCents: number
}

/** Net amount of one line in cents, rounded to the cent. */
export function lineNetCents(item: Pick<Item, 'quantity' | 'unitPriceCents'>): number {
  return Math.round(item.quantity * item.unitPriceCents)
}

/** Totals per VAT rate. Each rate is rounded once, so the sum matches what is printed. */
export function totals(items: Item[]): Totals {
  const byRate = new Map<VatRate, number>()
  for (const item of items) {
    byRate.set(item.vatRate, (byRate.get(item.vatRate) ?? 0) + lineNetCents(item))
  }
  const vat: VatLine[] = VAT_RATES.filter((rate) => byRate.has(rate)).map((rate) => {
    const netCents = byRate.get(rate) ?? 0
    return { rate, netCents, vatCents: Math.round((netCents * rate) / 100) }
  })
  const netCents = vat.reduce((sum, line) => sum + line.netCents, 0)
  const vatCents = vat.reduce((sum, line) => sum + line.vatCents, 0)
  return { netCents, vat, vatCents, grossCents: netCents + vatCents }
}

/** "1.234,56 €" */
export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

/** Parses "1.234,56" or "12,5" or "12.5" into cents. Returns null if it is not a number. */
export function parseEuroToCents(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(/€/g, '')
  if (!normalized) return null
  const withDot = normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized
  const value = Number(withDot)
  return Number.isFinite(value) ? Math.round(value * 100) : null
}

/** Next number for a kind and year, e.g. RE-2026-0007. The counter only goes up. */
export function nextNumber(prefix: string, year: number, counters: Record<string, number>): { number: string; key: string; value: number } {
  const key = `${prefix}-${year}`
  const value = (counters[key] ?? 0) + 1
  return { number: `${prefix}-${year}-${String(value).padStart(4, '0')}`, key, value }
}

export interface CompanyData {
  name: string
  street: string
  zip: string
  city: string
  taxNumber: string
  vatId: string
  email: string
  phone: string
  bank: string
  iban: string
  /** § 19 UStG: no VAT is charged and the invoice says so. */
  smallBusiness: boolean
}

/** Missing fields that an issued invoice needs (§ 14 UStG). Empty list means it may be issued. */
export function companyProblems(company: CompanyData): string[] {
  const problems: string[] = []
  if (!company.name.trim()) problems.push('Firmenname')
  if (!company.street.trim() || !company.zip.trim() || !company.city.trim()) problems.push('Anschrift')
  if (!company.taxNumber.trim() && !company.vatId.trim()) problems.push('Steuernummer oder USt-IdNr.')
  return problems
}

export interface DocumentDraft {
  customerName: string | null
  items: Item[]
}

/** Problems that stop a document from being issued. */
export function documentProblems(draft: DocumentDraft): string[] {
  const problems: string[] = []
  if (!draft.customerName || !draft.customerName.trim()) problems.push('Kunde')
  const usable = draft.items.filter((item) => item.description.trim() && item.quantity > 0)
  if (usable.length === 0) problems.push('mindestens eine Position mit Beschreibung und Menge')
  for (const item of draft.items) {
    if (item.unitPriceCents < 0) problems.push('negativer Preis')
  }
  return problems
}

/** The short note that § 19 UStG requires on a small business invoice. */
export const SMALL_BUSINESS_NOTE = 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'

export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
