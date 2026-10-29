import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { ask, BootAnimation, DulidanMark, ModeChooser, notify, NoticeArea, QuestionDialog, type BootVariant } from '@dulidan/design-system'
import type { Mode } from '@dulidan/core'
import { FolderDialog, MODE_CARDS, MoveDialog, SettingsDialog } from './dialogs/Dialogs'
import { t } from './i18n'
import { flush, handleOutsideChange, noteStore, openNote } from './state/note'
import { notesStore, refreshLists } from './state/notes'
import { applySettingsToDocument, prefersReducedMotion, settingsStore, updateSettings, useSettings } from './state/settings'
import { useUi } from './state/ui'
import { PrintSheet } from './ui/NoteView'
import { QuickNote } from './ui/QuickNote'
import { Workspace } from './ui/Workspace'

const IS_QUICK_NOTE = window.location.hash === '#quick'

function bootVariant(): BootVariant {
  const settings = settingsStore.get()
  if (prefersReducedMotion() || !settings.animations) return 'static'
  return settings.mode === 'basic' ? 'basic' : 'full'
}

/** Unsaved text from a crash: offer to put it back into the notes. */
async function offerRecovery(): Promise<void> {
  const recovered = await window.cortex.recovery.list()
  if (recovered.length === 0) return
  const answer = await ask({
    title: t.recovery.title,
    text: t.recovery.text(recovered.map((item) => `„${item.title}“`).join(', ')),
    cancelValue: 'restore',
    choices: [
      { value: 'discard', label: t.recovery.discard, variant: 'ghost' },
      { value: 'restore', label: t.recovery.restore, variant: 'primary' }
    ]
  })
  for (const item of recovered) {
    if (answer === 'restore') {
      const existing = await window.cortex.notes.load(item.path)
      if (existing.ok) await window.cortex.notes.save(item.path, item.body, existing.value.mtimeMs)
      else await window.cortex.notes.create({ title: item.title, body: item.body })
    }
    await window.cortex.recovery.discard(item.id)
  }
  if (answer === 'restore') notify(t.recovery.restored, 'success')
  await refreshLists()
}

/** Notes older than 30 days in the trash: ask whether to delete them for good. */
async function offerTrashCleanup(): Promise<void> {
  const expired = notesStore.get().trash.filter((entry) => entry.daysLeft === 0)
  if (expired.length === 0) return
  const answer = await ask({
    title: t.trash.expiredTitle,
    text: t.trash.expiredText(expired.length),
    cancelValue: 'keep',
    choices: [
      { value: 'keep', label: t.trash.keep, variant: 'ghost' },
      { value: 'delete', label: t.trash.deleteForGood, variant: 'primary' }
    ]
  })
  if (answer !== 'delete') return
  for (const entry of expired) await window.cortex.trash.deleteForGood(entry.path)
  notify(t.trash.deleted, 'success')
  await refreshLists()
}

function useMainWindowEvents(active: boolean): void {
  useEffect(() => {
    if (!active) return
    void refreshLists()
      .then(offerRecovery)
      .then(offerTrashCleanup)
    const offs = [
      window.cortex.events.onNotesChanged((result) => void handleOutsideChange(result)),
      window.cortex.events.onVaultChanged(() => {
        noteStore.set((state) => ({ ...state, current: null, backlinks: [] }))
        notesStore.set((state) => ({ ...state, view: { kind: 'all' }, query: '' }))
        void refreshLists()
      }),
      // Closing the window: save first, then close.
      window.cortex.events.onCloseRequested(() => void flush().then((saved) => saved && window.cortex.window.closeConfirmed())),
      window.cortex.events.onOpenNote((path) => void openNote(path))
    ]
    return () => offs.forEach((off) => off())
  }, [active])
}

function Shared(): React.JSX.Element {
  return (
    <>
      <QuestionDialog />
      <NoticeArea icons={{ info: <Info />, success: <CircleCheck />, error: <CircleAlert /> }} closeLabel={t.dialogs.close} />
    </>
  )
}

function MainApp(): React.JSX.Element {
  const settings = useSettings()
  const { printHtml } = useUi()
  const [variant] = useState(bootVariant)
  const [bootDone, setBootDone] = useState(false)
  const needsMode = settings.mode === null
  useMainWindowEvents(bootDone && !needsMode)

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
      {!bootDone && <BootAnimation programName={t.app.name} variant={variant} skipHint={t.app.skipHint} onDone={() => setBootDone(true)} />}
      <SettingsDialog />
      <FolderDialog />
      <MoveDialog />
      <Shared />
      {printHtml && createPortal(<PrintSheet title={printHtml.title} html={printHtml.html} />, document.body)}
    </>
  )
}

export function App(): React.JSX.Element {
  const settings = useSettings()
  useEffect(() => applySettingsToDocument(settings), [settings])
  if (IS_QUICK_NOTE) {
    return (
      <>
        <QuickNote />
        <Shared />
      </>
    )
  }
  return <MainApp />
}
