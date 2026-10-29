import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { BootAnimation, DulidanMark, ModeChooser, NoticeArea, QuestionDialog, type BootVariant } from '@dulidan/design-system'
import type { Mode } from '@dulidan/core'
import { AccountDialog } from './dialogs/AccountDialog'
import { MODE_CARDS, SettingsDialog } from './dialogs/SettingsDialog'
import { t } from './i18n'
import { applySettingsToDocument, prefersReducedMotion, settingsStore, updateSettings, useAccounts, useSettings } from './state/settings'
import { Workspace } from './ui/Workspace'

function bootVariant(): BootVariant {
  const settings = settingsStore.get()
  if (prefersReducedMotion() || !settings.animations) return 'static'
  return settings.mode === 'basic' ? 'basic' : 'full'
}

/**
 * Flow: start animation -> mode choice on the first start -> account setup
 * if there is no account yet -> mail.
 */
export function App(): React.JSX.Element {
  const settings = useSettings()
  const accounts = useAccounts()
  const [variant] = useState(bootVariant)
  const [bootDone, setBootDone] = useState(false)

  useEffect(() => applySettingsToDocument(settings), [settings])

  const needsMode = settings.mode === null
  const needsAccount = !needsMode && accounts.length === 0

  return (
    <>
      {needsMode ? (
        <ModeChooser
          title={t.modes.chooserTitle}
          text={t.modes.chooserText}
          chooseLabel={t.modes.choose}
          cards={MODE_CARDS}
          logo={<DulidanMark size={56} tile title="" />}
          onChoose={(mode: Mode) => void updateSettings({ mode })}
        />
      ) : (
        <Workspace />
      )}
      {bootDone && needsAccount && <AccountDialog firstRun />}
      {bootDone && !needsAccount && <AccountDialog />}
      {!bootDone && <BootAnimation programName={t.app.name} variant={variant} skipHint={t.app.skipHint} onDone={() => setBootDone(true)} />}
      <SettingsDialog />
      <QuestionDialog />
      <NoticeArea icons={{ info: <Info />, success: <CircleCheck />, error: <CircleAlert /> }} closeLabel={t.dialogs.close} />
    </>
  )
}
