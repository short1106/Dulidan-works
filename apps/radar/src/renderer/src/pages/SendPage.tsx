import { useEffect, useMemo, useState } from 'react'
import { ask, Button, Card, notify } from '@dulidan/design-system'
import type { Lead, SendProgress, TemplateInfo, MailPreview } from '../../../shared/api'
import { de as t } from '../i18n/de'
import { useSettings } from '../state/settings'

const IDLE: SendProgress = { state: 'fertig', total: 0, done: 0, skipped: 0, current: null, message: null }

/** Choose companies and a template, see a preview, then send with pauses. */
export function SendPage(): React.JSX.Element {
  const mode = useSettings().mode
  const [leads, setLeads] = useState<Lead[]>([])
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [templateId, setTemplateId] = useState('zimmerei')
  const [chosen, setChosen] = useState<string[]>([])
  const [previewLead, setPreviewLead] = useState<string | null>(null)
  const [preview, setPreview] = useState<MailPreview | null>(null)
  const [progress, setProgress] = useState<SendProgress>(IDLE)
  const [limit, setLimit] = useState(20)

  useEffect(() => {
    void window.radar.leads.list().then(setLeads)
    void window.radar.templates.list().then(setTemplates)
    void window.radar.config.get().then((config) => {
      setTemplateId(config.templateId)
      setLimit(config.dailyLimit)
    })
    void window.radar.send.status().then(setProgress)
    return window.radar.send.onProgress((next) => {
      setProgress(next)
      if (next.state !== 'laeuft') void window.radar.leads.list().then(setLeads)
    })
  }, [])

  useEffect(() => {
    void window.radar.templates.preview(templateId, previewLead).then(setPreview)
  }, [templateId, previewLead])

  // Only companies that can be mailed now: new, with an address.
  const ready = useMemo(() => leads.filter((lead) => lead.status === 'neu' && lead.email), [leads])
  const running = progress.state === 'laeuft'

  function toggle(id: string): void {
    setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function start(): Promise<void> {
    const yes = await ask({
      title: t.send.confirm,
      text: t.send.confirmText(chosen.length),
      choices: [
        { value: 'ja', label: t.send.confirmOk, variant: 'primary' },
        { value: 'nein', label: t.send.cancel, variant: 'ghost' }
      ],
      cancelValue: 'nein'
    })
    if (yes !== 'ja') return
    try {
      setProgress(await window.radar.send.start(chosen, templateId))
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.error, 'error')
    }
  }

  return (
    <section aria-labelledby="send-title" className="radar-page">
      <h1 id="send-title">{t.send.title}</h1>
      <p>{t.send.text}</p>
      <p className="radar-muted">{t.send.limit(limit)}</p>

      <div className="radar-form">
        <label>
          {t.send.template}
          <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.send.previewFor}
          <select value={previewLead ?? ''} onChange={(event) => setPreviewLead(event.target.value || null)}>
            <option value="">{t.send.sample}</option>
            {ready.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Card className="radar-card">
        <h2>{t.send.preview}</h2>
        {preview && (
          <>
            <p>
              <strong>Betreff:</strong> {preview.subject}
            </p>
            <pre className="radar-preview">{preview.body}</pre>
          </>
        )}
      </Card>

      {mode === 'pro' && <Card className="radar-card">{t.send.pro}</Card>}

      <div className="radar-toolbar">
        <Button onClick={() => setChosen(chosen.length === ready.length ? [] : ready.map((lead) => lead.id))}>{t.send.selectAll}</Button>
        <span aria-live="polite">{t.send.selected(chosen.length)}</span>
        <Button variant="primary" onClick={() => void start()} disabled={running || chosen.length === 0}>
          {t.send.start}
        </Button>
        <Button onClick={() => void window.radar.send.stop().then(setProgress)} disabled={!running}>
          {t.send.stop}
        </Button>
      </div>

      <ul className="radar-list">
        {ready.map((lead) => (
          <li key={lead.id}>
            <label>
              <input type="checkbox" checked={chosen.includes(lead.id)} onChange={() => toggle(lead.id)} /> {lead.name} <span className="radar-muted">{lead.email}</span>
            </label>
            <Button variant="ghost" onClick={() => setPreviewLead(lead.id)}>
              {t.send.preview}
            </Button>
          </li>
        ))}
      </ul>

      {progress.state !== 'fertig' || progress.total > 0 ? (
        <Card className="radar-card" aria-live="polite">
          <strong>{t.send.state[progress.state]}</strong>
          <p>{t.send.progress(progress.done, progress.total)}</p>
          {progress.skipped > 0 && <p>{t.send.skipped(progress.skipped)}</p>}
          {progress.current && <p>{progress.current}</p>}
          {progress.message && <p>{progress.message}</p>}
        </Card>
      ) : null}
    </section>
  )
}
