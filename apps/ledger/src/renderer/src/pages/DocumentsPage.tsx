import { useEffect, useMemo, useState } from 'react'
import { ask, Button, Card, notify } from '@dulidan/design-system'
import { companyProblems, documentProblems, formatEuro, todayIso, totals, parseEuroToCents, VAT_RATES, type Item, type VatRate } from '../../../main/logic'
import { balanceOf, canRemind, nextReminderLevel, type Reminder } from '../../../main/payments'
import type { Document, DocumentKind } from '../../../shared/api'
import { DocumentView, partiesOf } from '../components/DocumentView'
import { germanDate, ReminderView } from '../components/ReminderView'
import { de as t } from '../i18n/de'
import { change, cleanMessage, useData } from '../state/data'
import { useSettings } from '../state/settings'

/** Offers and invoices: list on the left, draft editor or printable view on the right. */
export function DocumentsPage(): React.JSX.Element {
  const data = useData()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [onlyOpen, setOnlyOpen] = useState(false)
  const selected = data.documents.find((doc) => doc.id === selectedId) ?? null
  const today = todayIso()
  const term = data.billing.paymentTermDays
  // Open items: issued invoices that are not fully paid.
  const isOpen = (doc: Document): boolean => doc.kind === 'rechnung' && doc.status === 'ausgestellt' && balanceOf(doc, today, term).state !== 'bezahlt'
  const openSum = data.documents.filter(isOpen).reduce((sum, doc) => sum + balanceOf(doc, today, term).openCents, 0)
  const sorted = useMemo(
    () => [...data.documents].filter((doc) => !onlyOpen || isOpen(doc)).sort((a, b) => b.createdAt - a.createdAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.documents, onlyOpen, today, term]
  )

  async function create(kind: DocumentKind): Promise<void> {
    const customerId = data.customers[0]?.id ?? null
    const next = await change(() => window.ledger.documents.create(kind, customerId))
    if (next) setSelectedId(next.documents[next.documents.length - 1].id)
  }

  return (
    <section aria-labelledby="documents-title" className="ledger-page ledger-split">
      <div className="ledger-column ledger-nav-column">
        <h1 id="documents-title">{t.documents.title}</h1>
        <div className="ledger-toolbar">
          <Button variant="primary" onClick={() => void create('rechnung')}>
            {t.documents.newInvoice}
          </Button>
          <Button onClick={() => void create('angebot')}>{t.documents.newOffer}</Button>
        </div>
        <div className="ledger-toolbar" role="group" aria-label={t.documents.filterOpen}>
          <Button variant={onlyOpen ? 'secondary' : 'primary'} onClick={() => setOnlyOpen(false)}>
            {t.documents.filterAll}
          </Button>
          <Button variant={onlyOpen ? 'primary' : 'secondary'} onClick={() => setOnlyOpen(true)}>
            {t.documents.filterOpen}
          </Button>
          <span className="ledger-muted" aria-live="polite">
            {t.documents.openSum(formatEuro(openSum))}
          </span>
        </div>
        {sorted.length === 0 ? (
          <p>{t.documents.empty}</p>
        ) : (
          <ul className="ledger-list">
            {sorted.map((doc) => {
              const customer = data.customers.find((item) => item.id === doc.customerId)
              const name = doc.snapshot?.customer.name ?? customer?.name ?? t.documents.noCustomer
              const payment = doc.kind === 'rechnung' && doc.status === 'ausgestellt' ? balanceOf(doc, today, term).state : null
              const status =
                doc.status === 'entwurf' ? t.documents.draft : doc.status === 'storniert' ? t.documents.cancelled : payment ? t.payments.state[payment] : t.documents.issued
              return (
                <li key={doc.id}>
                  <button className="ledger-linkbutton" aria-current={doc.id === selectedId ? 'true' : undefined} onClick={() => setSelectedId(doc.id)}>
                    <strong>{doc.number ?? t.documents.draft}</strong> · {t.documents.kind[doc.kind]} · {name}
                    <span className={payment === 'ueberfaellig' ? 'ledger-overdue' : 'ledger-muted'}>
                      {' '}
                      · {status} · {formatEuro(totals(doc.items).grossCents)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="ledger-column ledger-detail">
        {selected ? <Detail key={selected.id} doc={selected} onGone={() => setSelectedId(null)} /> : <p>{t.documents.selectDocument}</p>}
      </div>
    </section>
  )
}

function Detail({ doc, onGone }: { doc: Document; onGone: () => void }): React.JSX.Element {
  if (doc.status === 'entwurf') return <DraftEditor doc={doc} onGone={onGone} />
  return <IssuedView doc={doc} />
}

function DraftEditor({ doc, onGone }: { doc: Document; onGone: () => void }): React.JSX.Element {
  const data = useData()
  const [items, setItems] = useState<Item[]>(doc.items)
  const [customerId, setCustomerId] = useState<string | null>(doc.customerId)
  const [note, setNote] = useState(doc.note)
  const [prices, setPrices] = useState<string[]>(doc.items.map(priceText))
  const customer = data.customers.find((item) => item.id === customerId) ?? null

  useEffect(() => {
    setItems(doc.items)
    setPrices(doc.items.map(priceText))
  }, [doc.id])

  // Prices are typed as text ("12,50") and turned into cents only here.
  const priced = items.map((item, index) => ({ ...item, unitPriceCents: parseEuroToCents(prices[index] ?? '') ?? 0 }))
  const sum = totals(priced)

  function updateItem(index: number, patch: Partial<Item>): void {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function addItem(): void {
    setItems((current) => [...current, { description: '', quantity: 1, unit: 'Stk', unitPriceCents: 0, vatRate: data.company.smallBusiness ? 0 : 19 }])
    setPrices((current) => [...current, '0,00'])
  }

  function removeItem(index: number): void {
    setItems((current) => current.filter((_, i) => i !== index))
    setPrices((current) => current.filter((_, i) => i !== index))
  }

  async function save(): Promise<boolean> {
    const next = await change(() => window.ledger.documents.update(doc.id, { customerId, items: priced, note }))
    if (next) notify(t.documents.saved, 'success')
    return Boolean(next)
  }

  async function issue(): Promise<void> {
    const companyMissing = companyProblems(data.company)
    if (companyMissing.length > 0) return notify('Bitte erst unter Firma & Einstellungen eintragen: ' + companyMissing.join(', '), 'error')
    const problems = documentProblems({ customerName: customer?.name ?? null, items: priced })
    if (problems.length > 0) return notify(t.documents.notReady + ': ' + problems.join(', '), 'error')
    const yes = await ask({
      title: t.documents.issueTitle,
      text: t.documents.issueText,
      choices: [
        { value: 'ja', label: t.documents.confirmIssue, variant: 'primary' },
        { value: 'nein', label: t.documents.cancel, variant: 'ghost' }
      ],
      cancelValue: 'nein'
    })
    if (yes !== 'ja') return
    // Save the latest input first, then issue. The issued copy is what the window shows next.
    if (!(await save())) return
    if (await change(() => window.ledger.documents.issue(doc.id))) notify(t.documents.issuedNotice, 'success')
  }

  async function remove(): Promise<void> {
    const yes = await ask({
      title: t.documents.removeTitle,
      text: t.documents.removeText,
      choices: [
        { value: 'ja', label: t.documents.remove, variant: 'primary' },
        { value: 'nein', label: t.documents.cancel, variant: 'ghost' }
      ],
      cancelValue: 'nein'
    })
    if (yes !== 'ja') return
    if (await change(() => window.ledger.documents.remove(doc.id))) onGone()
  }

  return (
    <Card className="ledger-card">
      <h2>
        {t.documents.kind[doc.kind]} · {t.documents.draft}
      </h2>
      <label>
        {t.documents.customer}
        <select value={customerId ?? ''} onChange={(event) => setCustomerId(event.target.value || null)}>
          <option value="">{t.documents.noCustomer}</option>
          {data.customers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <table className="ledger-items ledger-edit">
        <thead>
          <tr>
            <th>{t.documents.description}</th>
            <th>{t.documents.quantity}</th>
            <th>{t.documents.unit}</th>
            <th>{t.documents.price}</th>
            <th>{t.documents.vat}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>
                <input aria-label={t.documents.description} value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} />
              </td>
              <td>
                <input
                  aria-label={t.documents.quantity}
                  inputMode="decimal"
                  value={String(item.quantity)}
                  onChange={(event) => updateItem(index, { quantity: Number(event.target.value.replace(',', '.')) || 0 })}
                />
              </td>
              <td>
                <input aria-label={t.documents.unit} value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} />
              </td>
              <td>
                <input
                  aria-label={t.documents.price}
                  inputMode="decimal"
                  value={prices[index] ?? ''}
                  onChange={(event) => setPrices((current) => current.map((price, i) => (i === index ? event.target.value : price)))}
                />
              </td>
              <td>
                <select
                  aria-label={t.documents.vat}
                  value={item.vatRate}
                  disabled={data.company.smallBusiness}
                  onChange={(event) => updateItem(index, { vatRate: Number(event.target.value) as VatRate })}
                >
                  {VAT_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate} %
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <Button variant="ghost" onClick={() => removeItem(index)} aria-label={t.documents.removeItem}>
                  ×
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button onClick={addItem}>{t.documents.addItem}</Button>

      <label>
        {t.documents.note}
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
      </label>

      <dl className="ledger-sums">
        <dt>{t.documents.net}</dt>
        <dd>{formatEuro(sum.netCents)}</dd>
        <dt>{t.documents.gross}</dt>
        <dd>
          <strong>{formatEuro(sum.grossCents)}</strong>
        </dd>
      </dl>

      <div className="ledger-toolbar">
        <Button onClick={() => void save()}>{t.documents.save}</Button>
        <Button variant="primary" onClick={() => void issue()}>
          {t.documents.issue}
        </Button>
        <Button variant="ghost" onClick={() => void remove()}>
          {t.documents.remove}
        </Button>
      </div>
      {customer === null && <p className="ledger-muted">{t.documents.noCustomer}</p>}
    </Card>
  )
}

function priceText(item: Item): string {
  return (item.unitPriceCents / 100).toFixed(2).replace('.', ',')
}

function IssuedView({ doc }: { doc: Document }): React.JSX.Element {
  const data = useData()
  const parties = partiesOf(doc, data.company, data.customers)
  // While a reminder is saved as PDF, the window shows it instead of the invoice.
  const [printing, setPrinting] = useState<Reminder | null>(null)
  const balance = balanceOf(doc, todayIso(), data.billing.paymentTermDays)

  async function reminderPdf(reminder: Reminder): Promise<void> {
    setPrinting(reminder)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    try {
      const path = await window.ledger.pdf.export(`${doc.number ?? 'Rechnung'} ${t.reminders.levels[reminder.level] ?? ''}`)
      if (path) notify(t.documents.pdfSaved, 'success')
    } catch (error) {
      notify(cleanMessage(error), 'error')
    } finally {
      setPrinting(null)
    }
  }

  async function cancel(): Promise<void> {
    const yes = await ask({
      title: t.documents.cancelTitle,
      text: t.documents.cancelText,
      choices: [
        { value: 'ja', label: t.documents.confirmCancel, variant: 'primary' },
        { value: 'nein', label: t.documents.cancel, variant: 'ghost' }
      ],
      cancelValue: 'nein'
    })
    if (yes !== 'ja') return
    if (await change(() => window.ledger.documents.cancel(doc.id))) notify(t.documents.cancelledNotice, 'success')
  }

  async function toInvoice(): Promise<void> {
    if (await change(() => window.ledger.documents.toInvoice(doc.id))) notify(t.documents.saved, 'success')
  }

  async function exportPdf(): Promise<void> {
    try {
      const path = await window.ledger.pdf.export(doc.number ?? 'Entwurf')
      if (path) notify(t.documents.pdfSaved, 'success')
    } catch (error) {
      notify(cleanMessage(error), 'error')
    }
  }

  return (
    <>
      <div className="ledger-toolbar ledger-no-print">
        <Button variant="primary" onClick={() => void exportPdf()}>
          {t.documents.pdf}
        </Button>
        {doc.kind === 'angebot' && <Button onClick={() => void toInvoice()}>{t.documents.toInvoice}</Button>}
        {doc.status === 'ausgestellt' && (
          <Button variant="ghost" onClick={() => void cancel()}>
            {t.documents.cancelDocument}
          </Button>
        )}
      </div>
      {doc.kind === 'rechnung' && doc.status === 'ausgestellt' && <PaymentsPanel doc={doc} onReminderPdf={(reminder) => void reminderPdf(reminder)} />}
      {printing ? <ReminderView doc={doc} parties={parties} reminder={printing} balance={balance} /> : <DocumentView doc={doc} parties={parties} />}
    </>
  )
}

function PaymentsPanel({ doc, onReminderPdf }: { doc: Document; onReminderPdf: (reminder: Reminder) => void }): React.JSX.Element {
  const data = useData()
  const mode = useSettings().mode
  const today = todayIso()
  const balance = balanceOf(doc, today, data.billing.paymentTermDays)
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const level = nextReminderLevel(doc.reminders)
  const levelName = level ? (t.reminders.levels[level] ?? '') : ''

  async function addPayment(cents: number | null): Promise<void> {
    if (cents === null || cents <= 0) return notify(t.payments.invalid, 'error')
    if (await change(() => window.ledger.documents.addPayment(doc.id, { date, amountCents: cents, note }))) {
      setAmount('')
      setNote('')
      notify(t.payments.added, 'success')
    }
  }

  async function removePayment(paymentId: string): Promise<void> {
    const yes = await ask({
      title: t.payments.removeTitle,
      text: t.payments.removeText,
      choices: [
        { value: 'ja', label: t.payments.remove, variant: 'primary' },
        { value: 'nein', label: t.documents.cancel, variant: 'ghost' }
      ],
      cancelValue: 'nein'
    })
    if (yes === 'ja') await change(() => window.ledger.documents.removePayment(doc.id, paymentId))
  }

  async function writeReminder(): Promise<void> {
    const yes = await ask({
      title: t.reminders.writeTitle(levelName),
      text: t.reminders.writeText,
      choices: [
        { value: 'ja', label: t.reminders.confirm, variant: 'primary' },
        { value: 'nein', label: t.documents.cancel, variant: 'ghost' }
      ],
      cancelValue: 'nein'
    })
    if (yes !== 'ja') return
    if (await change(() => window.ledger.documents.addReminder(doc.id))) notify(t.reminders.written, 'success')
  }

  return (
    <Card className="ledger-card ledger-no-print">
      <h2>
        {t.payments.title}: <span className={balance.state === 'ueberfaellig' ? 'ledger-overdue' : undefined}>{t.payments.state[balance.state]}</span>
      </h2>
      <dl className="ledger-sums">
        <dt>{t.payments.gross}</dt>
        <dd>{formatEuro(balance.grossCents)}</dd>
        <dt>{t.payments.paid}</dt>
        <dd>{formatEuro(balance.paidCents)}</dd>
        {balance.feesCents > 0 && (
          <>
            <dt>{t.payments.fees}</dt>
            <dd>{formatEuro(balance.feesCents)}</dd>
          </>
        )}
        <dt>{t.payments.open}</dt>
        <dd>
          <strong>{formatEuro(balance.openCents)}</strong>
        </dd>
      </dl>
      {balance.state !== 'bezahlt' && <p className="ledger-muted">{t.payments.due(germanDate(balance.dueDate))}</p>}

      {(doc.payments ?? []).length === 0 ? (
        <p className="ledger-muted">{t.payments.none}</p>
      ) : (
        <ul className="ledger-list">
          {(doc.payments ?? []).map((payment) => (
            <li key={payment.id} className="ledger-row">
              <span>
                {t.payments.entry(germanDate(payment.date), formatEuro(payment.amountCents))}
                {payment.note && <span className="ledger-muted"> · {payment.note}</span>}
              </span>
              <Button variant="ghost" onClick={() => void removePayment(payment.id)}>
                {t.payments.remove}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {balance.state !== 'bezahlt' && (
        <>
          <div className="ledger-form">
            <label>
              {t.payments.date}
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              {t.payments.amount}
              <input inputMode="decimal" placeholder={(balance.openCents / 100).toFixed(2).replace('.', ',')} value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            {mode !== 'basic' && (
              <label>
                {t.payments.note}
                <input value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            )}
          </div>
          <div className="ledger-toolbar">
            <Button variant="primary" onClick={() => void addPayment(balance.openCents)}>
              {t.payments.markPaid}
            </Button>
            <Button onClick={() => void addPayment(parseEuroToCents(amount))} disabled={!amount.trim()}>
              {t.payments.add}
            </Button>
          </div>
        </>
      )}

      {mode !== 'basic' && (
        <>
          <h3>{t.reminders.title}</h3>
          {(doc.reminders ?? []).map((reminder) => (
            <div key={reminder.level} className="ledger-row">
              <span>{t.reminders.entry(t.reminders.levels[reminder.level] ?? '', germanDate(reminder.date))}</span>
              <Button onClick={() => onReminderPdf(reminder)}>{t.reminders.pdf}</Button>
            </div>
          ))}
          {canRemind(doc, today, data.billing.paymentTermDays) && (
            <Button variant="primary" onClick={() => void writeReminder()}>
              {t.reminders.write(levelName)}
            </Button>
          )}
          {level === null && balance.state !== 'bezahlt' && <p className="ledger-muted">{t.reminders.last}</p>}
        </>
      )}
    </Card>
  )
}
