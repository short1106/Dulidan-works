import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Info, Briefcase, Feather, Sparkles } from 'lucide-react'
import { ask, BootAnimation, Button, DulidanMark, ModeChooser, NoticeArea, notify, type BootVariant, QuestionDialog } from '@dulidan/design-system'
import type { Mode } from '@dulidan/core'
import { PrintLayout } from './components/PrintLayout'
import { de as t } from './i18n/de'
import { EditorPage } from './pages/EditorPage'
import { PresentPage } from './pages/PresentPage'
import { SettingsPage } from './pages/SettingsPage'
import { deckStore, replaceDeck, useDeckState } from './state/deck'
import { updateSettings, useSettings } from './state/settings'

type Page = 'edit' | 'present' | 'settings'

const MODE_CARDS = [
  { mode: 'basic' as const, icon: <Feather />, name: t.modes.basic.name, text: t.modes.basic.text },
  { mode: 'expert' as const, icon: <Briefcase />, name: t.modes.expert.name, text: t.modes.expert.text },
  { mode: 'pro' as const, icon: <Sparkles />, name: t.modes.pro.name, text: t.modes.pro.text }
]

/**
 * Flow: start animation -> mode choice on the first start -> offer to restore
 * an unsaved presentation after a crash -> editor, presentation, settings.
 */
export function App(): React.JSX.Element {
  const settings = useSettings()
  const { deck } = useDeckState()
  const [bootDone, setBootDone] = useState(false)
  const [page, setPage] = useState<Page>('edit')
  const [variant] = useState<BootVariant>(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !settings.animations) return 'static'
    return settings.mode === 'basic' ? 'basic' : 'full'
  })

  useEffect(() => {
    document.title = t.app.name
  }, [])

  // Asked after the start animation, when the question dialog is on screen.
  useEffect(() => {
    if (bootDone) void checkRecovery()
  }, [bootDone])

  const notices = (
    <>
      <NoticeArea icons={{ info: <Info />, success: <CircleCheck />, error: <CircleAlert /> }} closeLabel={t.notices.close} />
      <QuestionDialog />
    </>
  )

  if (!bootDone) {
    return <BootAnimation programName={t.app.name} variant={variant} skipHint={t.app.skipHint} onDone={() => setBootDone(true)} />
  }

  if (settings.mode === null) {
    return (
      <>
        <ModeChooser
          title={t.modes.chooserTitle}
          text={t.modes.chooserText}
          chooseLabel={t.modes.choose}
          cards={MODE_CARDS}
          logo={<DulidanMark size={56} tile title="" />}
          onChoose={(mode: Mode) => void updateSettings({ mode })}
        />
        {notices}
      </>
    )
  }

  // Basis and Experte differ only in size and in the number of options; Pro adds a placeholder for April.
  if (page === 'present') {
    return (
      <>
        <PresentPage onExit={() => setPage('edit')} />
        {notices}
      </>
    )
  }

  const pages: Array<{ id: Page; label: string }> = [
    { id: 'edit', label: t.nav.edit },
    { id: 'present', label: t.nav.present },
    { id: 'settings', label: t.nav.settings }
  ]

  return (
    <div className="prism-shell">
      <nav className="prism-nav prism-no-print" aria-label="Hauptmenü">
        <div className="prism-brand">
          <DulidanMark size={34} tile title="" />
          <span>{t.app.name}</span>
        </div>
        {pages.map((item) => (
          <Button key={item.id} variant={page === item.id ? 'primary' : 'ghost'} aria-current={page === item.id ? 'page' : undefined} onClick={() => setPage(item.id)}>
            {item.label}
          </Button>
        ))}
      </nav>
      <main className="prism-main">
        {page === 'edit' && <EditorPage onPrint={exportPdf} />}
        {page === 'settings' && <SettingsPage />}
      </main>
      {/* Always in the page, visible only when printing to PDF (see styles). */}
      <PrintLayout deck={deck} />
      {notices}
    </div>
  )
}

async function exportPdf(): Promise<void> {
  const { deck } = deckStore.get()
  try {
    const path = await window.prism.pdf.export(deck.title)
    if (path) notify(t.file.pdfSaved, 'success')
  } catch (error) {
    notify(error instanceof Error ? error.message : t.notices.error, 'error')
  }
}

/** After a crash, a backup of the unsaved deck may exist. Offer to restore it. */
async function checkRecovery(): Promise<void> {
  const backup = await window.prism.recovery.load()
  if (!backup) return
  const restore = await ask({
    title: t.file.recoveryTitle,
    text: t.file.recoveryText,
    choices: [
      { value: 'ja', label: t.file.recoveryOk, variant: 'primary' },
      { value: 'nein', label: t.file.recoveryNo, variant: 'ghost' }
    ],
    cancelValue: 'nein'
  })
  if (restore === 'ja') {
    replaceDeck(backup, null)
    deckStore.set((state) => ({ ...state, dirty: true }))
  } else {
    await window.prism.recovery.discard()
  }
}
