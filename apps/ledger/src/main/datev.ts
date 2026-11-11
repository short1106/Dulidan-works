import { totals, type VatRate } from './logic'
import type { Document } from './store'

/**
 * Export for the tax advisor in the open DATEV format "EXTF Buchungsstapel"
 * (format version 700, category 21). One booking per invoice and VAT rate:
 * debtor account to revenue account, gross amount. A cancelled invoice is
 * booked back with "H" on the day it was cancelled.
 * The tax advisor should check one export before it is used for real.
 */

export type ChartOfAccounts = 'SKR03' | 'SKR04'

export interface DatevSettings {
  consultantNumber: string
  clientNumber: string
  chart: ChartOfAccounts
  /** Collective debtor account for all customers. */
  debtorAccount: string
  /** Revenue accounts per VAT rate and for small businesses (§ 19 UStG). */
  revenue19: string
  revenue7: string
  revenue0: string
  revenueSmall: string
}

/** Usual revenue accounts with automatic VAT in the two standard charts. */
export const CHART_DEFAULTS: Record<ChartOfAccounts, Omit<DatevSettings, 'consultantNumber' | 'clientNumber' | 'chart'>> = {
  SKR03: { debtorAccount: '10000', revenue19: '8400', revenue7: '8300', revenue0: '8100', revenueSmall: '8195' },
  SKR04: { debtorAccount: '10000', revenue19: '4400', revenue7: '4300', revenue0: '4100', revenueSmall: '4185' }
}

export const DEFAULT_DATEV: DatevSettings = { consultantNumber: '', clientNumber: '', chart: 'SKR03', ...CHART_DEFAULTS.SKR03 }

export function normalizeDatev(raw: unknown): DatevSettings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<DatevSettings>
  const chart: ChartOfAccounts = input.chart === 'SKR04' ? 'SKR04' : 'SKR03'
  const digits = (value: unknown, fallback: string): string => (typeof value === 'string' && /^\d{0,9}$/.test(value.trim()) ? value.trim() : fallback)
  const defaults = CHART_DEFAULTS[chart]
  return {
    consultantNumber: digits(input.consultantNumber, ''),
    clientNumber: digits(input.clientNumber, ''),
    chart,
    debtorAccount: digits(input.debtorAccount, defaults.debtorAccount) || defaults.debtorAccount,
    revenue19: digits(input.revenue19, defaults.revenue19) || defaults.revenue19,
    revenue7: digits(input.revenue7, defaults.revenue7) || defaults.revenue7,
    revenue0: digits(input.revenue0, defaults.revenue0) || defaults.revenue0,
    revenueSmall: digits(input.revenueSmall, defaults.revenueSmall) || defaults.revenueSmall
  }
}

const COLUMNS = [
  'Umsatz (ohne Soll/Haben-Kz)',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basis-Umsatz',
  'WKZ Basis-Umsatz',
  'Konto',
  'Gegenkonto (ohne BU-Schlüssel)',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Belegfeld 2',
  'Skonto',
  'Buchungstext'
]

export interface DatevBooking {
  amountCents: number
  side: 'S' | 'H'
  account: string
  contraAccount: string
  /** ISO date of the booking. */
  date: string
  number: string
  text: string
}

function revenueAccount(settings: DatevSettings, rate: VatRate, smallBusiness: boolean): string {
  if (smallBusiness) return settings.revenueSmall
  return rate === 19 ? settings.revenue19 : rate === 7 ? settings.revenue7 : settings.revenue0
}

function isoOf(time: number): string {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** The bookings of all invoices issued or cancelled between `from` and `to` (ISO dates, both included). */
export function datevBookings(documents: Document[], settings: DatevSettings, from: string, to: string): DatevBooking[] {
  const bookings: DatevBooking[] = []
  const inRange = (date: string): boolean => date >= from && date <= to
  const invoices = documents
    .filter((doc) => doc.kind === 'rechnung' && doc.status !== 'entwurf' && doc.number && doc.snapshot)
    .sort((a, b) => (a.number ?? '').localeCompare(b.number ?? ''))
  for (const doc of invoices) {
    const smallBusiness = doc.snapshot!.company.smallBusiness
    const lines = totals(doc.items).vat.filter((line) => line.netCents + line.vatCents !== 0)
    const book = (side: 'S' | 'H', date: string): void => {
      for (const line of lines) {
        bookings.push({
          amountCents: line.netCents + line.vatCents,
          side,
          account: settings.debtorAccount,
          contraAccount: revenueAccount(settings, line.rate, smallBusiness),
          date,
          number: doc.number!,
          text: (side === 'H' ? `Storno ${doc.snapshot!.customer.name}` : doc.snapshot!.customer.name).slice(0, 60)
        })
      }
    }
    if (inRange(doc.date)) book('S', doc.date)
    if (doc.status === 'storniert' && doc.cancelledAt && inRange(isoOf(doc.cancelledAt))) book('H', isoOf(doc.cancelledAt))
  }
  return bookings
}

function quote(text: string): string {
  return `"${text.replace(/"/g, '""').replace(/[\r\n;]+/g, ' ')}"`
}

function amount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** "2026-11-05" -> "0511" (day and month, as DATEV wants the voucher date). */
function dayMonth(iso: string): string {
  return iso.slice(8, 10) + iso.slice(5, 7)
}

const compact = (iso: string): string => iso.replace(/-/g, '')

/** The complete CSV text (still as a JavaScript string; see `encodeWindows1252`). */
export function datevCsv(bookings: DatevBooking[], settings: DatevSettings, from: string, to: string, created: Date): string {
  const stamp = `${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, '0')}${String(created.getDate()).padStart(2, '0')}${String(created.getHours()).padStart(2, '0')}${String(created.getMinutes()).padStart(2, '0')}${String(created.getSeconds()).padStart(2, '0')}000`
  const header = [
    '"EXTF"',
    '700',
    '21',
    '"Buchungsstapel"',
    '13',
    stamp,
    '',
    '"RE"',
    '""',
    '""',
    settings.consultantNumber,
    settings.clientNumber,
    `${from.slice(0, 4)}0101`,
    '4',
    compact(from),
    compact(to),
    quote(`Rechnungen ${from} bis ${to}`),
    '""',
    '1',
    '0',
    '0',
    '"EUR"',
    '',
    '""',
    '',
    '',
    quote(settings.chart === 'SKR04' ? '04' : '03'),
    '',
    '',
    '""',
    '""'
  ].join(';')
  const rows = bookings.map((booking) =>
    [amount(booking.amountCents), quote(booking.side), quote('EUR'), '', '', '""', booking.account, booking.contraAccount, '""', dayMonth(booking.date), quote(booking.number), '""', '', quote(booking.text)].join(';')
  )
  return [header, COLUMNS.map(quote).join(';'), ...rows].join('\r\n') + '\r\n'
}

/** Characters of Windows-1252 that differ from Latin-1 (DATEV reads files in this code page). */
const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
  'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f
}

/** Text -> bytes in Windows-1252. Characters that do not exist there become "?". */
export function encodeWindows1252(text: string): Uint8Array {
  const bytes: number[] = []
  for (const char of text) {
    const code = char.codePointAt(0)!
    if (CP1252[char] !== undefined) bytes.push(CP1252[char]!)
    else if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) bytes.push(code)
    else bytes.push(0x3f)
  }
  return Uint8Array.from(bytes)
}
