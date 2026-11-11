import { formatEuro } from '../../../main/logic'
import type { Balance, Reminder } from '../../../main/payments'
import type { Document } from '../../../shared/api'
import { de as t } from '../i18n/de'
import type { Parties } from './DocumentView'

/** "2026-11-11" -> "11.11.2026" */
export function germanDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}.${month}.${year}`
}

/**
 * A reminder letter (Zahlungserinnerung or Mahnung) for an issued invoice,
 * in the same print layout as the invoice.
 */
export function ReminderView({ doc, parties, reminder, balance }: { doc: Document; parties: Parties; reminder: Reminder; balance: Balance }): React.JSX.Element {
  const title = t.reminders.levels[reminder.level] ?? ''
  // Amounts as of this reminder: fees up to and including this one.
  const fees = (doc.reminders ?? []).filter((item) => item.date <= reminder.date).reduce((sum, item) => sum + item.feeCents, 0)
  const open = Math.max(0, balance.grossCents + fees - balance.paidCents)
  return (
    <article className="ledger-document" aria-label={title}>
      <header className="ledger-document-head">
        <div>
          <strong>{parties.company.name}</strong>
          <div>{parties.company.street}</div>
          <div>
            {parties.company.zip} {parties.company.city}
          </div>
        </div>
        <div className="ledger-document-meta">
          <h2>{title}</h2>
          <div>Datum: {germanDate(reminder.date)}</div>
        </div>
      </header>

      <address className="ledger-address">
        {parties.customer && (
          <>
            <div>{parties.customer.name}</div>
            <div>{parties.customer.street}</div>
            <div>
              {parties.customer.zip} {parties.customer.city}
            </div>
          </>
        )}
      </address>

      <p>
        <strong>{t.reminders.subject(doc.number ?? '')}</strong>
      </p>
      <p>{t.reminders.greeting}</p>
      <p>{t.reminders.text(reminder.level, doc.number ?? '', germanDate(doc.date))}</p>

      <dl className="ledger-sums">
        <dt>{t.payments.gross}</dt>
        <dd>{formatEuro(balance.grossCents)}</dd>
        {balance.paidCents > 0 && (
          <>
            <dt>{t.payments.paid}</dt>
            <dd>− {formatEuro(balance.paidCents)}</dd>
          </>
        )}
        {fees > 0 && (
          <>
            <dt>{t.payments.fees}</dt>
            <dd>{formatEuro(fees)}</dd>
          </>
        )}
        <dt>{t.payments.open}</dt>
        <dd>
          <strong>{formatEuro(open)}</strong>
        </dd>
      </dl>

      <p>{t.reminders.request(germanDate(reminder.dueDate))}</p>
      <p>{t.reminders.already}</p>
      <p>
        {t.reminders.closing}
        <br />
        {parties.company.name}
      </p>
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
