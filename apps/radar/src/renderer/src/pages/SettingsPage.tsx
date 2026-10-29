import { useEffect, useState } from 'react'
import { Button, Card, TextField, notify } from '@dulidan/design-system'
import type { RadarConfig } from '../../../shared/api'
import { de as t } from '../i18n/de'
import { updateSettings, useSettings } from '../state/settings'

const MODES = [
  { id: 'basic', label: t.modes.basic.name },
  { id: 'expert', label: t.modes.expert.name },
  { id: 'pro', label: t.modes.pro.name }
] as const

/** Keys, mail server, sending rules and the appearance. */
export function SettingsPage(): React.JSX.Element {
  const settings = useSettings()
  const [config, setConfig] = useState<RadarConfig | null>(null)
  const [placesKey, setPlacesKey] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    void window.radar.config.get().then(setConfig)
  }, [])

  if (!config) return <p>…</p>

  function set<K extends keyof RadarConfig>(key: K, value: RadarConfig[K]): void {
    setConfig((current) => (current ? { ...current, [key]: value } : current))
  }

  async function save(): Promise<void> {
    if (!config) return
    try {
      const saved = await window.radar.config.update({
        branche: config.branche,
        ort: config.ort,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        senderName: config.senderName,
        senderEmail: config.senderEmail,
        dailyLimit: config.dailyLimit,
        pauseMinSeconds: config.pauseMinSeconds,
        pauseMaxSeconds: config.pauseMaxSeconds,
        templateId: config.templateId
      })
      setConfig(saved)
      if (placesKey || smtpPassword) {
        const withSecrets = await window.radar.config.saveSecrets({
          ...(placesKey ? { placesKey } : {}),
          ...(smtpPassword ? { smtpPassword } : {})
        })
        setConfig(withSecrets)
        setPlacesKey('')
        setSmtpPassword('')
      }
      notify(t.settings.saved, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.error, 'error')
    }
  }

  async function test(): Promise<void> {
    setTesting(true)
    const result = await window.radar.smtp.test()
    setTesting(false)
    notify(result.message, result.ok ? 'success' : 'error')
  }

  return (
    <section aria-labelledby="settings-title" className="radar-page">
      <h1 id="settings-title">{t.settings.title}</h1>

      <Card className="radar-card">
        <h2>{t.settings.places}</h2>
        <p>{t.settings.placesText}</p>
        <p className="radar-muted">{config.hasPlacesKey ? t.settings.placesSaved : t.settings.placesEmpty}</p>
        <TextField label={t.settings.places} type="password" autoComplete="off" value={placesKey} onChange={(event) => setPlacesKey(event.target.value)} />
      </Card>

      <Card className="radar-card">
        <h2>{t.settings.mail}</h2>
        <div className="radar-form">
          <TextField label={t.settings.smtpHost} value={config.smtpHost} onChange={(event) => set('smtpHost', event.target.value)} />
          <TextField label={t.settings.smtpPort} type="number" value={config.smtpPort} onChange={(event) => set('smtpPort', Number(event.target.value))} />
          <TextField label={t.settings.smtpUser} value={config.smtpUser} onChange={(event) => set('smtpUser', event.target.value)} />
          <TextField label={t.settings.smtpPassword} type="password" autoComplete="new-password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} />
          <TextField label={t.settings.senderName} value={config.senderName} onChange={(event) => set('senderName', event.target.value)} />
          <TextField label={t.settings.senderEmail} type="email" value={config.senderEmail} onChange={(event) => set('senderEmail', event.target.value)} />
        </div>
        <p className="radar-muted">{config.hasSmtpPassword ? t.settings.passwordSaved : null}</p>
        <div className="radar-toolbar">
          <Button onClick={() => void test()} disabled={testing}>
            {t.settings.test}
          </Button>
        </div>
      </Card>

      <Card className="radar-card">
        <h2>{t.settings.search}</h2>
        <div className="radar-form">
          <TextField label={t.settings.dailyLimit} type="number" min={1} max={200} value={config.dailyLimit} onChange={(event) => set('dailyLimit', Number(event.target.value))} />
          <TextField label={t.settings.pauseMin} type="number" min={10} value={config.pauseMinSeconds} onChange={(event) => set('pauseMinSeconds', Number(event.target.value))} />
          <TextField label={t.settings.pauseMax} type="number" min={10} value={config.pauseMaxSeconds} onChange={(event) => set('pauseMaxSeconds', Number(event.target.value))} />
        </div>
      </Card>

      <Card className="radar-card">
        <h2>{t.settings.appearance}</h2>
        <div className="radar-toolbar">
          {MODES.map((item) => (
            <Button key={item.id} variant={settings.mode === item.id ? 'primary' : 'secondary'} onClick={() => void updateSettings({ mode: item.id })}>
              {t.settings.mode}: {item.label}
            </Button>
          ))}
          <Button onClick={() => void updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}>
            {settings.theme === 'dark' ? t.settings.themeLight : t.settings.themeDark}
          </Button>
        </div>
      </Card>

      <div className="radar-toolbar">
        <Button variant="primary" onClick={() => void save()}>
          {t.settings.save}
        </Button>
      </div>
    </section>
  )
}
