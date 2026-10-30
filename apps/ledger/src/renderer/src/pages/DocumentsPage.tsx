import { useEffect, useMemo, useState } from 'react'
import { ask, Button, Card, notify } from '@dulidan/design-system'
import { companyProblems, documentProblems, formatEuro, totals, parseEuroToCents, VAT_RATES, type Item, type VatRate } from '../../../main/logic'
import type { Document, DocumentKind } from '../../../shared/api'
import { DocumentView, partiesOf } from '../components/DocumentView'
import { de as t } from '../i18n/de'
import { change, cleanMessage, useData } from '../state/data'

/** Offers and invoices: list on the left, draft editor or printable view on the right. */
export function DocumentsPage(): React.JSX.Element {
  const data = useData()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = data.documents.find((doc) => doc.id === selectedId) ?? null
  const sorted = useMemo(() => [...data.documents].sort((a, b) => b.createdAt - a.createdAt), [data.documents])

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
        {sorted.length === 0 ? (
          <p>{t.documents.empty}</p>
        ) : (
          <ul className="ledger-list">
            {sorted.map((doc) => {
              const customer = data.customers.find((item) => item.id === doc.customerId)
              const name = doc.snapshot?.customer.name ?? customer?.name ?? t.documents.noCustomer
              const status = doc.status === 'entwurf' ? t.documents.draft : doc.status === 'storniert' ? t.documents.cancelled : t.documents.issued
              return (
                <li key={doc.id}>
                  <button className="ledger-linkbutton" aria-current={doc.id === selectedId ? 'true' : undefined} onClick={() => setSelectedId(doc.id)}>
                    <strong>{doc.number ?? t.documents.draft}</strong> · {t.documents.kind[doc.kind]} · {name}
                    <span className="ledger-muted">
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
      <DocumentView doc={doc} parties={parties} />
    </>
  )
}
