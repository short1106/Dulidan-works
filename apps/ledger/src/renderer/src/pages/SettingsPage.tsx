import { useState } from 'react'
import { Button, Card, TextField, notify } from '@dulidan/design-system'
import { CHART_DEFAULTS, type ChartOfAccounts } from '../../../main/datev'
import { parseEuroToCents, todayIso } from '../../../main/logic'
import type { BillingSettings, CompanyData, DatevSettings } from '../../../shared/api'
import { de as t } from '../i18n/de'
import { updateSettings, useSettings } from '../state/settings'
import { change, cleanMessage, useData } from '../state/data'

/** First and last day of the previous month, e.g. for the monthly export. */
function lastMonth(today: string): { from: string; to: string } {
  const [year, month] = today.split('-').map(Number) as [number, number]
  const first = new Date(Date.UTC(year, month - 2, 1))
  const last = new Date(Date.UTC(year, month - 1, 0))
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) }
}

/** Your company data (printed on every document) and the appearance. */
export function SettingsPage(): React.JSX.Element {
  const { company, billing } = useData()
  const settings = useSettings()
  const [draft, setDraft] = useState<CompanyData>(company)
  const [terms, setTerms] = useState<BillingSettings>(billing)
  const [fee, setFee] = useState((billing.reminderFeeCents / 100).toFixed(2).replace('.', ','))
  const [range, setRange] = useState(() => lastMonth(todayIso()))
  const expert = settings.mode !== 'basic'

  function setDatev<K extends keyof DatevSettings>(key: K, value: DatevSettings[K]): void {
    setTerms((current) => ({ ...current, datev: { ...current.datev, [key]: value } }))
  }

  function setChart(chart: ChartOfAccounts): void {
    // A new chart brings its usual accounts; numbers can be changed afterwards.
    setTerms((current) => ({ ...current, datev: { ...current.datev, chart, ...CHART_DEFAULTS[chart] } }))
  }

  async function saveTerms(): Promise<boolean> {
    const next = await change(() => window.ledger.billing.save({ ...terms, reminderFeeCents: parseEuroToCents(fee) ?? 0 }))
    if (next) notify(t.settings.saved, 'success')
    return Boolean(next)
  }

  async function exportDatev(): Promise<void> {
    if (!(await saveTerms())) return
    try {
      const result = await window.ledger.datev.export(range.from, range.to)
      if (result) notify(t.settings.exported(result.bookings), 'success')
    } catch (error) {
      notify(cleanMessage(error), 'error')
    }
  }

  function set<K extends keyof CompanyData>(key: K, value: CompanyData[K]): void {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function save(): Promise<void> {
    if (await change(() => window.ledger.company.save(draft))) notify(t.settings.saved, 'success')
  }

  return (
    <section aria-labelledby="settings-title" className="ledger-page">
      <h1 id="settings-title">{t.settings.title}</h1>

      <Card className="ledger-card">
        <h2>{t.settings.company}</h2>
        <p>{t.settings.companyText}</p>
        <div className="ledger-form">
          <TextField label={t.settings.name} value={draft.name} onChange={(event) => set('name', event.target.value)} />
          <TextField label={t.settings.street} value={draft.street} onChange={(event) => set('street', event.target.value)} />
          <TextField label={t.settings.zip} value={draft.zip} onChange={(event) => set('zip', event.target.value)} />
          <TextField label={t.settings.city} value={draft.city} onChange={(event) => set('city', event.target.value)} />
          <TextField label={t.settings.taxNumber} value={draft.taxNumber} onChange={(event) => set('taxNumber', event.target.value)} />
          <TextField label={t.settings.vatId} value={draft.vatId} onChange={(event) => set('vatId', event.target.value)} />
          <TextField label={t.settings.email} type="email" value={draft.email} onChange={(event) => set('email', event.target.value)} />
          <TextField label={t.settings.phone} value={draft.phone} onChange={(event) => set('phone', event.target.value)} />
          <TextField label={t.settings.bank} value={draft.bank} onChange={(event) => set('bank', event.target.value)} />
          <TextField label={t.settings.iban} value={draft.iban} onChange={(event) => set('iban', event.target.value)} />
        </div>
        <label className="ledger-check">
          <input type="checkbox" checked={draft.smallBusiness} onChange={(event) => set('smallBusiness', event.target.checked)} /> {t.settings.smallBusiness}
        </label>
        <div className="ledger-toolbar">
          <Button variant="primary" onClick={() => void save()}>
            {t.settings.save}
          </Button>
        </div>
      </Card>

      <Card className="ledger-card">
        <h2>{t.settings.billing}</h2>
        <div className="ledger-form">
          <TextField
            label={t.settings.paymentTerm}
            type="number"
            min={0}
            max={120}
            value={terms.paymentTermDays}
            onChange={(event) => setTerms((current) => ({ ...current, paymentTermDays: Number(event.target.value) }))}
          />
          {expert && <TextField label={t.settings.reminderFee} inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} />}
        </div>
        {expert && <p className="ledger-muted">{t.settings.billingText}</p>}
        <div className="ledger-toolbar">
          <Button variant="primary" onClick={() => void saveTerms()}>
            {t.settings.save}
          </Button>
        </div>
      </Card>

      {expert && (
        <Card className="ledger-card">
          <h2>{t.settings.datev}</h2>
          <p>{t.settings.datevText}</p>
          <div className="ledger-form">
            <TextField label={t.settings.consultant} inputMode="numeric" value={terms.datev.consultantNumber} onChange={(event) => setDatev('consultantNumber', event.target.value)} />
            <TextField label={t.settings.client} inputMode="numeric" value={terms.datev.clientNumber} onChange={(event) => setDatev('clientNumber', event.target.value)} />
            <label>
              {t.settings.chart}
              <select value={terms.datev.chart} onChange={(event) => setChart(event.target.value as ChartOfAccounts)}>
                <option value="SKR03">SKR03</option>
                <option value="SKR04">SKR04</option>
              </select>
            </label>
            <TextField label={t.settings.debtor} inputMode="numeric" value={terms.datev.debtorAccount} onChange={(event) => setDatev('debtorAccount', event.target.value)} />
            <TextField label={t.settings.revenue19} inputMode="numeric" value={terms.datev.revenue19} onChange={(event) => setDatev('revenue19', event.target.value)} />
            <TextField label={t.settings.revenue7} inputMode="numeric" value={terms.datev.revenue7} onChange={(event) => setDatev('revenue7', event.target.value)} />
            <TextField label={t.settings.revenue0} inputMode="numeric" value={terms.datev.revenue0} onChange={(event) => setDatev('revenue0', event.target.value)} />
            <TextField label={t.settings.revenueSmall} inputMode="numeric" value={terms.datev.revenueSmall} onChange={(event) => setDatev('revenueSmall', event.target.value)} />
          </div>
          <div className="ledger-form">
            <TextField label={t.settings.from} type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
            <TextField label={t.settings.to} type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
          </div>
          <div className="ledger-toolbar">
            <Button variant="primary" onClick={() => void exportDatev()}>
              {t.settings.export}
            </Button>
          </div>
        </Card>
      )}

      <Card className="ledger-card">
        <h2>{t.settings.appearance}</h2>
        <div className="ledger-toolbar">
          {(['basic', 'expert', 'pro'] as const).map((mode) => (
            <Button key={mode} variant={settings.mode === mode ? 'primary' : 'secondary'} onClick={() => void updateSettings({ mode })}>
              {t.settings.mode}: {t.modes[mode].name}
            </Button>
          ))}
          <Button onClick={() => void updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}>
            {settings.theme === 'dark' ? t.settings.themeLight : t.settings.themeDark}
          </Button>
        </div>
      </Card>
    </section>
  )
}
