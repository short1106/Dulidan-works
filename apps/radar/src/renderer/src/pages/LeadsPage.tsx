import { useEffect, useState } from 'react'
import { Button, Card, notify } from '@dulidan/design-system'
import type { Lead, LeadStatus, TemplateInfo } from '../../../shared/api'
import { de as t } from '../i18n/de'

const STATUSES: LeadStatus[] = ['neu', 'kontaktiert', 'antwort', 'unzustellbar', 'kein_interesse']
const FILTERS: Array<LeadStatus | 'alle'> = ['alle', ...STATUSES]
const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Reply, bounce or letter, in one short line under the status. */
function history(lead: Lead): string | null {
  if (lead.replyAt && lead.status === 'antwort') return `${t.leads.replyOn(dateFormat.format(lead.replyAt))}${lead.replySubject ? `: ${lead.replySubject}` : ''}`
  if (lead.replyAt && lead.status === 'unzustellbar') return t.leads.bounceOn(dateFormat.format(lead.replyAt))
  if (lead.letterAt) return t.leads.letterOn(dateFormat.format(lead.letterAt))
  return null
}

/** All companies with their status, website check and blocklist. */
export function LeadsPage(): React.JSX.Element {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filter, setFilter] = useState<LeadStatus | 'alle'>('alle')
  const [checking, setChecking] = useState(false)
  const [blocklist, setBlocklist] = useState('')
  const [checkingReplies, setCheckingReplies] = useState(false)
  const [chosen, setChosen] = useState<string[]>([])
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [templateId, setTemplateId] = useState('zimmerei')

  useEffect(() => {
    void window.radar.leads.list().then(setLeads)
    void window.radar.blocklist.get().then((entries) => setBlocklist(entries.join('\n')))
    void window.radar.templates.list().then(setTemplates)
    void window.radar.config.get().then((config) => setTemplateId(config.templateId))
  }, [])

  async function checkReplies(): Promise<void> {
    setCheckingReplies(true)
    try {
      const result = await window.radar.replies.check()
      setLeads(await window.radar.leads.list())
      notify(t.leads.repliesResult(result.replies, result.bounces), result.replies > 0 ? 'success' : 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.error, 'error')
    } finally {
      setCheckingReplies(false)
    }
  }

  async function exportLetters(): Promise<void> {
    try {
      const file = await window.radar.letters.export(chosen, templateId)
      if (!file) return
      setLeads(await window.radar.leads.list())
      notify(t.leads.lettersSaved(chosen.length), 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.error, 'error')
    }
  }

  function toggle(id: string): void {
    setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

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
        <Button onClick={() => void checkReplies()} disabled={checkingReplies}>
          {checkingReplies ? t.leads.checkingReplies : t.leads.checkReplies}
        </Button>
      </div>

      <div className="radar-toolbar">
        <Button onClick={() => setChosen(chosen.length === shown.length ? [] : shown.map((lead) => lead.id))}>{t.leads.selectShown}</Button>
        <span aria-live="polite">{t.leads.selected(chosen.length)}</span>
        <label>
          {t.leads.lettersTemplate}{' '}
          <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" onClick={() => void exportLetters()} disabled={chosen.length === 0}>
          {t.leads.letters}
        </Button>
      </div>

      {shown.length === 0 ? (
        <p>{t.leads.empty}</p>
      ) : (
        <table className="radar-table">
          <thead>
            <tr>
              <th />
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
                  <input type="checkbox" aria-label={t.leads.select(lead.name)} checked={chosen.includes(lead.id)} onChange={() => toggle(lead.id)} />
                </td>
                <td>
                  {lead.name}
                  {lead.website ? null : <div className="radar-muted">{t.leads.noWebsite}</div>}
                </td>
                <td>{lead.address}</td>
                <td>{lead.email ?? <span className="radar-muted">{t.leads.noEmail}</span>}</td>
                <td>
                  <select aria-label={`${t.leads.columns.status}: ${lead.name}`} value={lead.status} onChange={(event) => void changeStatus(lead.id, event.target.value as LeadStatus)}>
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {t.leads.status[status]}
                      </option>
                    ))}
                  </select>
                  {history(lead) && <div className="radar-reply">{history(lead)}</div>}
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
