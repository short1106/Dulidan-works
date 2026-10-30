import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  companyProblems,
  documentProblems,
  formatEuro,
  lineNetCents,
  nextNumber,
  parseEuroToCents,
  totals,
  type CompanyData,
  type Item
} from '../src/main/logic'
import { DocumentError, LedgerStore } from '../src/main/store'

const item = (overrides: Partial<Item> = {}): Item => ({
  description: 'Dachstuhl prüfen',
  quantity: 1,
  unit: 'Stk',
  unitPriceCents: 10_000,
  vatRate: 19,
  ...overrides
})

const company: CompanyData = {
  name: 'Dulidan Studios',
  street: 'Musterweg 1',
  zip: '74613',
  city: 'Öhringen',
  taxNumber: '12/345/67890',
  vatId: '',
  email: 'info@example.test',
  phone: '',
  bank: '',
  iban: '',
  smallBusiness: false
}

function freshStore(): LedgerStore {
  return new LedgerStore(join(mkdtempSync(join(tmpdir(), 'ledger-test-')), 'data.json'))
}

describe('Beträge', () => {
  it('rundet jede Position auf den Cent', () => {
    expect(lineNetCents({ quantity: 2.5, unitPriceCents: 3333 })).toBe(8333)
  })

  it('rechnet die Umsatzsteuer je Satz aus', () => {
    const result = totals([item({ unitPriceCents: 10_000, vatRate: 19 }), item({ unitPriceCents: 5_000, vatRate: 7 })])
    expect(result.netCents).toBe(15_000)
    expect(result.vat).toEqual([
      { rate: 7, netCents: 5_000, vatCents: 350 },
      { rate: 19, netCents: 10_000, vatCents: 1_900 }
    ])
    expect(result.vatCents).toBe(2_250)
    expect(result.grossCents).toBe(17_250)
  })

  it('setzt bei 0 Prozent keine Steuer an', () => {
    expect(totals([item({ vatRate: 0 })]).vatCents).toBe(0)
  })

  it('formatiert und liest Euro-Beträge auf Deutsch', () => {
    expect(formatEuro(123456)).toBe('1.234,56 €')
    expect(parseEuroToCents('1.234,56')).toBe(123456)
    expect(parseEuroToCents('12,5')).toBe(1250)
    expect(parseEuroToCents('abc')).toBeNull()
  })
})

describe('Nummern', () => {
  it('zählt je Art und Jahr hoch', () => {
    expect(nextNumber('RE', 2026, {}).number).toBe('RE-2026-0001')
    expect(nextNumber('RE', 2026, { 'RE-2026': 7 }).number).toBe('RE-2026-0008')
    expect(nextNumber('AN', 2026, { 'RE-2026': 7 }).number).toBe('AN-2026-0001')
  })
})

describe('Pflichtangaben', () => {
  it('verlangt Anschrift und Steuernummer', () => {
    expect(companyProblems({ ...company, street: '', taxNumber: '', vatId: '' })).toEqual(['Anschrift', 'Steuernummer oder USt-IdNr.'])
    expect(companyProblems(company)).toEqual([])
  })

  it('verlangt Kunde und mindestens eine vollständige Position', () => {
    expect(documentProblems({ customerName: null, items: [item({ description: '' })] })).toEqual([
      'Kunde',
      'mindestens eine Position mit Beschreibung und Menge'
    ])
    expect(documentProblems({ customerName: 'Hofmann', items: [item()] })).toEqual([])
  })
})

describe('Speicher und Regeln', () => {
  it('vergibt beim Ausstellen eine Nummer und friert das Dokument ein', async () => {
    const store = freshStore()
    await store.load()
    await store.saveCompany(company)
    const customer = await store.saveCustomer({ name: 'Anna Holz', street: 'Weg 2', zip: '74613', city: 'Öhringen', email: '' })
    const draft = await store.createDocument('rechnung', customer.id)
    await store.updateDraft(draft.id, { items: [item()] })

    const issued = await store.issue(draft.id, new Date(2026, 9, 30))

    expect(issued.number).toBe('RE-2026-0001')
    expect(issued.status).toBe('ausgestellt')
    expect(issued.snapshot?.customer.name).toBe('Anna Holz')
    await expect(store.updateDraft(draft.id, { note: 'später geändert' })).rejects.toThrow(DocumentError)
    await expect(store.deleteDraft(draft.id)).rejects.toThrow('nicht gelöscht')
  })

  it('zählt Nummern lückenlos weiter, auch nach einer Stornierung', async () => {
    const store = freshStore()
    await store.load()
    await store.saveCompany(company)
    const customer = await store.saveCustomer({ name: 'Anna Holz', street: 'Weg 2', zip: '74613', city: 'Öhringen', email: '' })
    const first = await store.createDocument('rechnung', customer.id)
    await store.updateDraft(first.id, { items: [item()] })
    await store.issue(first.id)
    await store.cancel(first.id)
    const second = await store.createDocument('rechnung', customer.id)
    await store.updateDraft(second.id, { items: [item()] })

    const issued = await store.issue(second.id)

    expect(issued.number).toBe('RE-' + new Date().getFullYear() + '-0002')
    expect(store.find(first.id).status).toBe('storniert')
  })

  it('verweigert das Ausstellen ohne Firmendaten', async () => {
    const store = freshStore()
    await store.load()
    const customer = await store.saveCustomer({ name: 'Anna Holz', street: 'Weg 2', zip: '74613', city: 'Öhringen', email: '' })
    const draft = await store.createDocument('rechnung', customer.id)
    await store.updateDraft(draft.id, { items: [item()] })
    await expect(store.issue(draft.id)).rejects.toThrow('Firmenname')
  })

  it('kopiert ein Angebot in einen neuen Rechnungsentwurf', async () => {
    const store = freshStore()
    await store.load()
    const offer = await store.createDocument('angebot', null)
    await store.updateDraft(offer.id, { items: [item({ description: 'Bad' })], note: 'Gültig 30 Tage' })
    const invoice = await store.offerToInvoice(offer.id)
    expect(invoice.kind).toBe('rechnung')
    expect(invoice.status).toBe('entwurf')
    expect(invoice.items[0].description).toBe('Bad')
  })
})
