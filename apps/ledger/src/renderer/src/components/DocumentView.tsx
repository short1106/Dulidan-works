import { Fragment } from 'react'
import { formatEuro, totals, VAT_RATES } from '../../../main/logic'
import type { CompanyData, Customer, Document } from '../../../shared/api'
import { de as t } from '../i18n/de'

export interface Parties {
  company: CompanyData
  customer: { name: string; street: string; zip: string; city: string } | null
}

/**
 * The document as it is printed. Issued documents use the snapshot from the
 * day they were issued; drafts show the current company and customer data.
 */
export function partiesOf(doc: Document, company: CompanyData, customers: Customer[]): Parties {
  if (doc.snapshot) return { company: doc.snapshot.company, customer: doc.snapshot.customer }
  const customer = customers.find((item) => item.id === doc.customerId)
  return { company, customer: customer ? { name: customer.name, street: customer.street, zip: customer.zip, city: customer.city } : null }
}

export function DocumentView({ doc, parties }: { doc: Document; parties: Parties }): React.JSX.Element {
  const sum = totals(doc.items)
  const title = doc.kind === 'rechnung' ? t.documents.kind.rechnung : t.documents.kind.angebot
  return (
    <article className="ledger-document" aria-label={title}>
      <header className="ledger-document-head">
        <div>
          <strong>{parties.company.name}</strong>
          <div>{parties.company.street}</div>
          <div>
            {parties.company.zip} {parties.company.city}
          </div>
          {parties.company.taxNumber && <div>Steuernummer: {parties.company.taxNumber}</div>}
          {parties.company.vatId && <div>USt-IdNr.: {parties.company.vatId}</div>}
        </div>
        <div className="ledger-document-meta">
          <h2>{title}</h2>
          {doc.number && <div>Nr. {doc.number}</div>}
          <div>Datum: {doc.date}</div>
          {doc.status === 'storniert' && <div className="ledger-cancelled">STORNIERT</div>}
        </div>
      </header>

      <address className="ledger-address">
        {parties.customer ? (
          <>
            <div>{parties.customer.name}</div>
            <div>{parties.customer.street}</div>
            <div>
              {parties.customer.zip} {parties.customer.city}
            </div>
          </>
        ) : (
          <div className="ledger-muted">{t.documents.noCustomer}</div>
        )}
      </address>

      <table className="ledger-items">
        <thead>
          <tr>
            <th>{t.documents.description}</th>
            <th>{t.documents.quantity}</th>
            <th>{t.documents.price}</th>
            <th>{t.documents.vat}</th>
            <th>Summe</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => (
            <tr key={index}>
              <td>{item.description}</td>
              <td>
                {item.quantity} {item.unit}
              </td>
              <td>{formatEuro(item.unitPriceCents)}</td>
              <td>{item.vatRate} %</td>
              <td>{formatEuro(Math.round(item.quantity * item.unitPriceCents))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ledger-sums">
        <dt>{t.documents.net}</dt>
        <dd>{formatEuro(sum.netCents)}</dd>
        {VAT_RATES.filter((rate) => rate > 0 && sum.vat.some((line) => line.rate === rate)).map((rate) => {
          const line = sum.vat.find((entry) => entry.rate === rate)
          return (
            <Fragment key={rate}>
              <dt>{t.documents.vatLine(rate)}</dt>
              <dd>{formatEuro(line?.vatCents ?? 0)}</dd>
            </Fragment>
          )
        })}
        <dt>{t.documents.gross}</dt>
        <dd>
          <strong>{formatEuro(sum.grossCents)}</strong>
        </dd>
      </dl>

      {doc.note && <p className="ledger-note">{doc.note}</p>}
      <footer className="ledger-document-foot">
        {parties.company.iban && (
          <div>
            Bankverbindung: {parties.company.bank} · IBAN {parties.company.iban}
          </div>
        )}
        <div>{parties.company.email}</div>
      </footer>
    </article>
  )
}
