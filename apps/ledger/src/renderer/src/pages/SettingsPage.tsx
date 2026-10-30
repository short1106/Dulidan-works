import { useState } from 'react'
import { Button, Card, TextField, notify } from '@dulidan/design-system'
import type { CompanyData } from '../../../shared/api'
import { de as t } from '../i18n/de'
import { updateSettings, useSettings } from '../state/settings'
import { change, useData } from '../state/data'

/** Your company data (printed on every document) and the appearance. */
export function SettingsPage(): React.JSX.Element {
  const { company } = useData()
  const settings = useSettings()
  const [draft, setDraft] = useState<CompanyData>(company)

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
