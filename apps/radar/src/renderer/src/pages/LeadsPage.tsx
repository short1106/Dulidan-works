import { useEffect, useState } from 'react'
import { Button, Card, notify } from '@dulidan/design-system'
import type { Lead, LeadStatus } from '../../../shared/api'
import { de as t } from '../i18n/de'

const FILTERS: Array<LeadStatus | 'alle'> = ['alle', 'neu', 'kontaktiert', 'antwort', 'kein_interesse']

/** All companies with their status, website check and blocklist. */
export function LeadsPage(): React.JSX.Element {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filter, setFilter] = useState<LeadStatus | 'alle'>('alle')
  const [checking, setChecking] = useState(false)
  const [blocklist, setBlocklist] = useState('')

  useEffect(() => {
    void window.radar.leads.list().then(setLeads)
    void window.radar.blocklist.get().then((entries) => setBlocklist(entries.join('\n')))
  }, [])

  const shown = leads.filter((lead) => filter === 'alle' || lead.status === filter)

  async function checkAll(): Promise<void> {
    setChecking(true)
    try {
      const open = leads.filter((lead) => lead.website && lead.checkedAt === null)
      for (const lead of open) {
        setLeads(await window.radar.leads.checkWebsite(lead.id))
      }
      notify(`${open.length} Websites geprüft.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.error, 'error')
    } finally {
      setChecking(false)
    }
  }

  async function changeStatus(id: string, status: LeadStatus): Promise<void> {
    setLeads(await window.radar.leads.update(id, { status }))
  }

  async function changeNote(id: string, note: string): Promise<void> {
    setLeads(await window.radar.leads.update(id, { note }))
  }

  async function remove(id: string): Promise<void> {
    setLeads(await window.radar.leads.remove(id))
  }

  async function saveBlocklist(): Promise<void> {
    const saved = await window.radar.blocklist.set(blocklist.split('\n'))
    setBlocklist(saved.join('\n'))
    notify(t.settings.saved, 'success')
  }

  return (
    <section aria-labelledby="leads-title" className="radar-page">
      <h1 id="leads-title">{t.leads.title}</h1>
      <div className="radar-toolbar">
        {FILTERS.map((item) => (
          <Button key={item} variant={filter === item ? 'primary' : 'secondary'} onClick={() => setFilter(item)}>
            {item === 'alle' ? t.leads.filterAll : t.leads.status[item]}
          </Button>
        ))}
        <Button onClick={() => void checkAll()} disabled={checking}>
          {checking ? t.leads.checking : t.leads.checkAll}
        </Button>
      </div>

      {shown.length === 0 ? (
        <p>{t.leads.empty}</p>
      ) : (
        <table className="radar-table">
          <thead>
            <tr>
              <th>{t.leads.columns.name}</th>
              <th>{t.leads.columns.address}</th>
              <th>{t.leads.columns.email}</th>
              <th>{t.leads.columns.status}</th>
              <th>{t.leads.note}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((lead) => (
              <tr key={lead.id}>
                <td>
                  {lead.name}
                  {lead.website ? null : <div className="radar-muted">{t.leads.noWebsite}</div>}
                </td>
                <td>{lead.address}</td>
                <td>{lead.email ?? <span className="radar-muted">{t.leads.noEmail}</span>}</td>
                <td>
                  <select aria-label={`${t.leads.columns.status}: ${lead.name}`} value={lead.status} onChange={(event) => void changeStatus(lead.id, event.target.value as LeadStatus)}>
                    {(['neu', 'kontaktiert', 'antwort', 'kein_interesse'] as LeadStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {t.leads.status[status]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`${t.leads.note}: ${lead.name}`}
                    defaultValue={lead.note}
                    onBlur={(event) => {
                      if (event.target.value !== lead.note) void changeNote(lead.id, event.target.value)
                    }}
                  />
                </td>
                <td>
                  <Button variant="ghost" onClick={() => void remove(lead.id)}>
                    {t.leads.remove}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Card className="radar-card">
        <h2>{t.leads.blocklistTitle}</h2>
        <p>{t.leads.blocklistText}</p>
        <textarea className="radar-blocklist" aria-label={t.leads.blocklistTitle} value={blocklist} onChange={(event) => setBlocklist(event.target.value)} rows={5} />
        <Button onClick={() => void saveBlocklist()}>{t.leads.blocklistSave}</Button>
      </Card>
    </section>
  )
}
