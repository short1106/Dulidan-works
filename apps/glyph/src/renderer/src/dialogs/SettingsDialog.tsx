import { useEffect, useState } from 'react'
import { Button, Dialog, cx } from '@dulidan/design-system'
import { BASIC_FONT_SCALES, type BasicFontScale } from '@dulidan/core'
import { MODE_CARDS } from '../first-run/ModeChooser'
import { t } from '../i18n'
import { updateSettings, useSettings } from '../state/settings'
import { setUi, useUi } from '../state/ui'

const FONT_LABELS: Record<BasicFontScale, string> = {
  1: t.settings.fontNormal,
  1.15: t.settings.fontLarge,
  1.3: t.settings.fontXLarge
}

interface OptionGroupProps<T extends string | number | boolean> {
  label: string
  value: T
  options: Array<{ value: T; label: string; description?: string }>
  onChange: (value: T) => void
}

/** A row of big choice buttons that works like radio buttons. */
function OptionGroup<T extends string | number | boolean>({ label, value, options, onChange }: OptionGroupProps<T>): React.JSX.Element {
  return (
    <fieldset className="settings__group">
      <legend className="settings__legend">{label}</legend>
      <div className="settings__options">
        {options.map((option) => (
          <label key={String(option.value)} className={cx('settings__option', option.value === value && 'is-selected')}>
            <input type="radio" name={label} checked={option.value === value} onChange={() => onChange(option.value)} />
            <span className="settings__option-label">{option.label}</span>
            {option.description && <span className="settings__option-text">{option.description}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function SettingsDialog(): React.JSX.Element {
  const { settingsOpen } = useUi()
  const settings = useSettings()
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.glyph.appInfo().then((info) => setVersion(info.version))
  }, [])
  const close = (): void => setUi({ settingsOpen: false })

  return (
    <Dialog
      open={settingsOpen}
      title={t.settings.title}
      onClose={close}
      className="settings"
      actions={
        <Button variant="primary" onClick={close}>
          {t.dialogs.close}
        </Button>
      }
    >
      <OptionGroup
        label={t.settings.mode}
        value={settings.mode ?? 'basic'}
        options={MODE_CARDS.map((card) => ({ value: card.mode, label: card.name, description: card.text }))}
        onChange={(mode) => void updateSettings({ mode })}
      />
      <OptionGroup
        label={t.settings.theme}
        value={settings.theme}
        options={[
          { value: 'dark', label: t.settings.dark },
          { value: 'light', label: t.settings.light }
        ]}
        onChange={(theme) => void updateSettings({ theme })}
      />
      <OptionGroup
        label={t.settings.animations}
        value={settings.animations}
        options={[
          { value: true, label: t.settings.animationsOn },
          { value: false, label: t.settings.animationsOff }
        ]}
        onChange={(animations) => void updateSettings({ animations })}
      />
      <p className="settings__hint">{t.settings.animationsHint}</p>
      <OptionGroup
        label={t.settings.basicFontSize}
        value={settings.basicFontScale}
        options={BASIC_FONT_SCALES.map((scale) => ({ value: scale, label: FONT_LABELS[scale] }))}
        onChange={(basicFontScale) => void updateSettings({ basicFontScale })}
      />
      <p className="settings__about">{t.settings.about(version)}</p>
    </Dialog>
  )
}
