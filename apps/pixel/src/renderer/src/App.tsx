import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { BootAnimation, DulidanMark, ModeChooser, NoticeArea, QuestionDialog, type BootVariant } from '@dulidan/design-system'
import type { Mode } from '@dulidan/core'
import { SavedDialog } from './dialogs/SavedDialog'
import { MODE_CARDS, SettingsDialog } from './dialogs/SettingsDialog'
import { t } from './i18n'
import { applySettingsToDocument, prefersReducedMotion, settingsStore, updateSettings, useSettings } from './state/settings'
import { Workspace } from './ui/Workspace'

/** Picks the start animation once, from the settings at startup. */
function bootVariant(): BootVariant {
  const settings = settingsStore.get()
  if (prefersReducedMotion() || !settings.animations) return 'static'
  return settings.mode === 'basic' ? 'basic' : 'full'
}

/**
 * Flow: start animation -> on the first start the mode choice -> workspace.
 * The workspace is built behind the animation, which fades into it.
 */
export function App(): React.JSX.Element {
  const settings = useSettings()
  const [variant] = useState(bootVariant)
  const [bootDone, setBootDone] = useState(false)

  useEffect(() => applySettingsToDocument(settings), [settings])

  return (
    <>
      {settings.mode === null ? (
        <ModeChooser
          title={t.modes.chooserTitle}
          text={t.modes.chooserText}
          chooseLabel={t.modes.choose}
          cards={MODE_CARDS}
          logo={<DulidanMark size={56} tile title="" />}
          onChoose={(mode: Mode) => void updateSettings({ mode })}
        />
      ) : (
        <Workspace active={bootDone} />
      )}
      {!bootDone && <BootAnimation programName={t.app.name} variant={variant} skipHint={t.app.skipHint} onDone={() => setBootDone(true)} />}
      <SettingsDialog />
      <SavedDialog />
      <QuestionDialog />
      <NoticeArea icons={{ info: <Info />, success: <CircleCheck />, error: <CircleAlert /> }} closeLabel={t.dialogs.close} />
    </>
  )
}
