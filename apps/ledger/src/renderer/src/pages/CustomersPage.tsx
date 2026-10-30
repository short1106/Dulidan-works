import { useState } from 'react'
import { Button, Card, TextField, notify } from '@dulidan/design-system'
import type { Customer } from '../../../shared/api'
import { de as t } from '../i18n/de'
import { change, useData } from '../state/data'

const EMPTY: Omit<Customer, 'id'> = { name: '', street: '', zip: '', city: '', email: '' }

export function CustomersPage(): React.JSX.Element {
  const { customers } = useData()
  const [editing, setEditing] = useState<Omit<Customer, 'id'> & { id?: string }>(EMPTY)

  async function save(): Promise<void> {
    if (!editing.name.trim()) return notify(t.customers.name + ': bitte ausfüllen', 'error')
    const next = await change(() => window.ledger.customers.save(editing))
    if (next) {
      notify(t.customers.saved, 'success')
      setEditing(EMPTY)
    }
  }

  async function remove(id: string): Promise<void> {
    const next = await change(() => window.ledger.customers.remove(id))
    if (next) notify(t.customers.removed, 'success')
  }

  return (
    <section aria-labelledby="customers-title" className="ledger-page">
      <h1 id="customers-title">{t.customers.title}</h1>
      <p>{t.customers.text}</p>

      <Card className="ledger-card">
        <div className="ledger-form">
          <TextField label={t.customers.name} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
          <TextField label={t.customers.street} value={editing.street} onChange={(event) => setEditing({ ...editing, street: event.target.value })} />
          <TextField label={t.customers.zip} value={editing.zip} onChange={(event) => setEditing({ ...editing, zip: event.target.value })} />
          <TextField label={t.customers.city} value={editing.city} onChange={(event) => setEditing({ ...editing, city: event.target.value })} />
          <TextField label={t.customers.email} type="email" value={editing.email} onChange={(event) => setEditing({ ...editing, email: event.target.value })} />
        </div>
        <div className="ledger-toolbar">
          <Button variant="primary" onClick={() => void save()}>
            {t.customers.save}
          </Button>
          {editing.id && <Button onClick={() => setEditing(EMPTY)}>{t.documents.cancel}</Button>}
        </div>
      </Card>

      {customers.length === 0 ? (
        <p>{t.customers.empty}</p>
      ) : (
        <ul className="ledger-list">
          {customers.map((customer) => (
            <li key={customer.id}>
              <span>
                <strong>{customer.name}</strong> <span className="ledger-muted">{[customer.street, `${customer.zip} ${customer.city}`.trim()].filter(Boolean).join(', ')}</span>
              </span>
              <span className="ledger-toolbar">
                <Button variant="ghost" onClick={() => setEditing(customer)}>
                  {t.customers.edit}
                </Button>
                <Button variant="ghost" onClick={() => void remove(customer.id)}>
                  {t.customers.remove}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
