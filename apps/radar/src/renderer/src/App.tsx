import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Feather, Briefcase, Info, Sparkles } from 'lucide-react'
import { BootAnimation, Button, DulidanMark, ModeChooser, NoticeArea, type BootVariant, QuestionDialog } from '@dulidan/design-system'
import type { Mode } from '@dulidan/core'
import { de as t } from './i18n/de'
import { SearchPage } from './pages/SearchPage'
import { LeadsPage } from './pages/LeadsPage'
import { SendPage } from './pages/SendPage'
import { SettingsPage } from './pages/SettingsPage'
import { updateSettings, useSettings } from './state/settings'

type Page = 'search' | 'leads' | 'send' | 'settings'

const MODE_CARDS = [
  { mode: 'basic' as const, icon: <Feather />, name: t.modes.basic.name, text: t.modes.basic.text },
  { mode: 'expert' as const, icon: <Briefcase />, name: t.modes.expert.name, text: t.modes.expert.text },
  { mode: 'pro' as const, icon: <Sparkles />, name: t.modes.pro.name, text: t.modes.pro.text }
]

/**
 * Flow: start animation -> mode choice on the first start -> the four pages.
 * Radar keeps no animation for the reduce-motion setting: the static logo is used then.
 */
export function App(): React.JSX.Element {
  const settings = useSettings()
  const [bootDone, setBootDone] = useState(false)
  const [page, setPage] = useState<Page>('search')
  const [variant] = useState<BootVariant>(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !settings.animations) return 'static'
    return settings.mode === 'basic' ? 'basic' : 'full'
  })

  useEffect(() => {
    document.title = t.app.name
  }, [])

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
        <NoticeArea icons={{ info: <Info />, success: <CircleCheck />, error: <CircleAlert /> }} closeLabel={t.notices.close} />
        <QuestionDialog />
      </>
    )
  }

  const pages: Array<{ id: Page; label: string; view: React.JSX.Element }> = [
    { id: 'search', label: t.nav.search, view: <SearchPage /> },
    { id: 'leads', label: t.nav.leads, view: <LeadsPage /> },
    { id: 'send', label: t.nav.send, view: <SendPage /> },
    { id: 'settings', label: t.nav.settings, view: <SettingsPage /> }
  ]
  const current = pages.find((item) => item.id === page) ?? pages[0]

  return (
    <div className="radar-shell">
      <nav className="radar-nav" aria-label="Hauptmenü">
        <div className="radar-brand">
          <DulidanMark size={34} tile title="" />
          <span>{t.app.name}</span>
        </div>
        {pages.map((item) => (
          <Button
            key={item.id}
            variant={page === item.id ? 'primary' : 'ghost'}
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <main className="radar-main">{current.view}</main>
      <NoticeArea icons={{ info: <Info />, success: <CircleCheck />, error: <CircleAlert /> }} closeLabel={t.notices.close} />
      <QuestionDialog />
    </div>
  )
}
