import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { datevBookings, datevCsv, DEFAULT_DATEV, encodeWindows1252, normalizeDatev } from '../src/main/datev'
import { addDays, balanceOf, canRemind, nextReminderLevel } from '../src/main/payments'
import { DocumentError, LedgerStore, type Document } from '../src/main/store'

/** Test data only: an invented company and customer, in a fresh folder. */
async function storeWithInvoice(issueDate: Date): Promise<{ store: LedgerStore; invoice: Document }> {
  const store = new LedgerStore(join(mkdtempSync(join(tmpdir(), 'ledger-pay-')), 'ledger-data.json'))
  await store.load()
  await store.saveCompany({
    name: 'Test Zimmerei', street: 'Holzweg 1', zip: '74613', city: 'Öhringen', taxNumber: '12/345/67890', vatId: '', email: '', phone: '', bank: '', iban: '', smallBusiness: false
  })
  const customer = await store.saveCustomer({ name: 'Familie Müller', street: 'Am Bach 2', zip: '74629', city: 'Pfedelbach', email: '' })
  const draft = await store.createDocument('rechnung', customer.id)
  await store.updateDraft(draft.id, {
    items: [
      { description: 'Dachstuhl', quantity: 10, unit: 'Std', unitPriceCents: 5000, vatRate: 19 },
      { description: 'Fachbuch', quantity: 1, unit: 'Stk', unitPriceCents: 1000, vatRate: 7 }
    ]
  })
  const invoice = await store.issue(draft.id, issueDate)
  return { store, invoice }
}

describe('payments', () => {
  it('sets the due date when issuing and tracks open, partly paid and paid', async () => {
    const { store, invoice } = await storeWithInvoice(new Date(2026, 10, 2))
    // 500 € + 19 % = 595 €, 10 € + 7 % = 10,70 € -> 605,70 €
    expect(invoice.dueDate).toBe('2026-11-16')
    expect(balanceOf(invoice, '2026-11-05')).toMatchObject({ grossCents: 60570, openCents: 60570, state: 'offen' })

    const partly = await store.addPayment(invoice.id, { date: '2026-11-10', amountCents: 30000, note: 'Anzahlung' })
    expect(balanceOf(partly, '2026-11-10')).toMatchObject({ paidCents: 30000, openCents: 30570, state: 'teilweise' })
    expect(balanceOf(partly, '2026-11-20').state).toBe('ueberfaellig')

    const paid = await store.addPayment(invoice.id, { date: '2026-11-12', amountCents: 30570, note: '' })
    expect(balanceOf(paid, '2026-12-31')).toMatchObject({ openCents: 0, state: 'bezahlt' })
    // The invoice itself never changes.
    expect(paid.items).toEqual(invoice.items)
    expect(paid.number).toBe(invoice.number)

    const corrected = await store.removePayment(invoice.id, paid.payments![1]!.id)
    expect(balanceOf(corrected, '2026-11-12').state).toBe('teilweise')
  })

  it('refuses payments for drafts, offers and wrong amounts', async () => {
    const { store, invoice } = await storeWithInvoice(new Date(2026, 10, 2))
    await expect(store.addPayment(invoice.id, { date: '2026-11-10', amountCents: 0, note: '' })).rejects.toBeInstanceOf(DocumentError)
    const offer = await store.createDocument('angebot', null)
    await expect(store.addPayment(offer.id, { date: '2026-11-10', amountCents: 100, note: '' })).rejects.toBeInstanceOf(DocumentError)
    await store.cancel(invoice.id)
    await expect(store.addPayment(invoice.id, { date: '2026-11-10', amountCents: 100, note: '' })).rejects.toBeInstanceOf(DocumentError)
  })

  it('older invoices without due date use the payment term', () => {
    const old = { items: [], date: '2026-01-10', dueDate: undefined, payments: undefined, reminders: undefined }
    expect(balanceOf({ ...old, items: [{ description: 'x', quantity: 1, unit: 'Stk', unitPriceCents: 100, vatRate: 19 }] }, '2026-01-30', 14)).toMatchObject({
      dueDate: '2026-01-24',
      state: 'ueberfaellig'
    })
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08')
  })
})

describe('reminders', () => {
  it('only overdue invoices get reminders: Zahlungserinnerung, 1. Mahnung, 2. Mahnung, then stop', async () => {
    const { store, invoice } = await storeWithInvoice(new Date(2026, 9, 1))
    await store.saveBilling({ ...store.data().billing, reminderFeeCents: 500 })
    expect(canRemind(invoice, '2026-10-10')).toBe(false)
    await expect(store.addReminder(invoice.id, new Date(2026, 9, 10))).rejects.toBeInstanceOf(DocumentError)

    const first = await store.addReminder(invoice.id, new Date(2026, 9, 20))
    expect(first.reminders).toEqual([{ level: 1, date: '2026-10-20', dueDate: '2026-10-27', feeCents: 0 }])
    // The new deadline counts: not overdue again before it.
    expect(balanceOf(first, '2026-10-25').state).toBe('offen')

    const second = await store.addReminder(invoice.id, new Date(2026, 9, 30))
    expect(second.reminders?.[1]).toMatchObject({ level: 2, feeCents: 500 })
    expect(balanceOf(second, '2026-10-30').openCents).toBe(60570 + 500)
    const third = await store.addReminder(invoice.id, new Date(2026, 10, 10))
    expect(third.reminders?.[2]?.level).toBe(3)
    expect(nextReminderLevel(third.reminders)).toBeNull()
    await expect(store.addReminder(invoice.id, new Date(2026, 10, 30))).rejects.toBeInstanceOf(DocumentError)
  })
})

describe('DATEV export', () => {
  it('books each VAT rate on its revenue account and cancellations back with H', async () => {
    const { store, invoice } = await storeWithInvoice(new Date(2026, 10, 2))
    await store.cancel(invoice.id, new Date(2026, 11, 3))
    const settings = { ...DEFAULT_DATEV, consultantNumber: '1234567', clientNumber: '10001' }
    const november = datevBookings(store.data().documents, settings, '2026-11-01', '2026-11-30')
    // One line per VAT rate, in the order of the rates (7 %, then 19 %).
    expect(november).toEqual([
      { amountCents: 1070, side: 'S', account: '10000', contraAccount: '8300', date: '2026-11-02', number: 'RE-2026-0001', text: 'Familie Müller' },
      { amountCents: 59500, side: 'S', account: '10000', contraAccount: '8400', date: '2026-11-02', number: 'RE-2026-0001', text: 'Familie Müller' }
    ])
    const december = datevBookings(store.data().documents, settings, '2026-12-01', '2026-12-31')
    expect(december.map((booking) => [booking.side, booking.amountCents, booking.date])).toEqual([
      ['H', 1070, '2026-12-03'],
      ['H', 59500, '2026-12-03']
    ])

    const csv = datevCsv(november, settings, '2026-11-01', '2026-11-30', new Date(2026, 11, 1, 9, 30, 0))
    const lines = csv.split('\r\n')
    expect(lines[0]).toMatch(/^"EXTF";700;21;"Buchungsstapel";13;20261201093000000;;"RE";"";"";1234567;10001;20260101;4;20261101;20261130;/)
    expect(lines[1]).toBe('"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen";"WKZ Umsatz";"Kurs";"Basis-Umsatz";"WKZ Basis-Umsatz";"Konto";"Gegenkonto (ohne BU-Schlüssel)";"BU-Schlüssel";"Belegdatum";"Belegfeld 1";"Belegfeld 2";"Skonto";"Buchungstext"')
    expect(lines[3]).toBe('595,00;"S";"EUR";;;"";10000;8400;"";0211;"RE-2026-0001";"";;"Familie Müller"')
    expect(lines[2]).toBe('10,70;"S";"EUR";;;"";10000;8300;"";0211;"RE-2026-0001";"";;"Familie Müller"')
  })

  it('small businesses book everything on the § 19 account; SKR04 uses its own accounts', async () => {
    const { store } = await storeWithInvoice(new Date(2026, 10, 2))
    const documents = store.data().documents.map((doc) => (doc.snapshot ? { ...doc, snapshot: { ...doc.snapshot, company: { ...doc.snapshot.company, smallBusiness: true } } } : doc))
    expect(datevBookings(documents, DEFAULT_DATEV, '2026-11-01', '2026-11-30').map((booking) => booking.contraAccount)).toEqual(['8195', '8195'])
    const skr04 = normalizeDatev({ chart: 'SKR04' })
    expect(datevBookings(store.data().documents, skr04, '2026-11-01', '2026-11-30').map((booking) => booking.contraAccount)).toEqual(['4300', '4400'])
    expect(normalizeDatev({ consultantNumber: 'abc', debtorAccount: '' }).debtorAccount).toBe('10000')
  })

  it('writes Windows-1252, as DATEV expects', () => {
    expect([...encodeWindows1252('Müller €')]).toEqual([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72, 0x20, 0x80])
    expect([...encodeWindows1252('😀')]).toEqual([0x3f])
  })
})
