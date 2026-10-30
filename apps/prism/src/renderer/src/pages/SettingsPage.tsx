import { Button, Card } from '@dulidan/design-system'
import { de as t } from '../i18n/de'
import { updateSettings, useSettings } from '../state/settings'

/** Mode and colors. Sizes and options change with the mode. */
export function SettingsPage(): React.JSX.Element {
  const settings = useSettings()
  return (
    <section aria-labelledby="settings-title" className="prism-page">
      <h1 id="settings-title">{t.settings.title}</h1>
      <Card className="prism-card">
        <h2>{t.settings.appearance}</h2>
        <div className="prism-toolbar">
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
