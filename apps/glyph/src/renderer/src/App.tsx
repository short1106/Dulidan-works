import { useEffect, useState } from 'react'
import type { Mode } from '@dulidan/core'
import { NoticeArea } from './dialogs/NoticeArea'
import { QuestionDialog } from './dialogs/QuestionDialog'
import { SavedDialog } from './dialogs/SavedDialog'
import { SettingsDialog } from './dialogs/SettingsDialog'
import { ModeChooser } from './first-run/ModeChooser'
import { StartAnimation, type StartVariant } from './start/StartAnimation'
import { applySettingsToDocument, prefersReducedMotion, settingsStore, updateSettings, useSettings } from './state/settings'
import { Workspace } from './workspace/Workspace'

/** Picks the start animation once, from the settings at startup. */
function startVariant(): StartVariant {
  const settings = settingsStore.get()
  if (prefersReducedMotion() || !settings.animations) return 'static'
  // The first start (no mode yet) gets the full show.
  return settings.mode === 'basic' ? 'basic' : 'full'
}

/**
 * Flow: start animation -> on the first start the mode choice -> workspace.
 * The workspace is already built behind the animation, which fades into it.
 */
export function App(): React.JSX.Element {
  const settings = useSettings()
  const [variant] = useState(startVariant)
  const [startDone, setStartDone] = useState(false)

  useEffect(() => applySettingsToDocument(settings), [settings])

  const chooseMode = (mode: Mode): void => void updateSettings({ mode })

  return (
    <>
      {settings.mode === null ? <ModeChooser onChoose={chooseMode} /> : <Workspace active={startDone} />}
      {!startDone && <StartAnimation variant={variant} onDone={() => setStartDone(true)} />}
      <SettingsDialog />
      <SavedDialog />
      <QuestionDialog />
      <NoticeArea />
    </>
  )
}
