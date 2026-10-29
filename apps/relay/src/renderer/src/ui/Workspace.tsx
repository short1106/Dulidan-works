import { useEffect } from 'react'
import { CalendarDays, Inbox, Mail, PenSquare, RefreshCw, Settings as SettingsIcon, Trash2 } from 'lucide-react'
import { cx, DulidanMark, IconButton, Toolbar } from '@dulidan/design-system'
import { CalendarView } from '../calendar/CalendarView'
import { can } from '../features'
import { shortcut, t } from '../i18n'
import { closeCompose, openCompose, useCompose } from '../state/compose'
import { listenToMain, mailStore, moveToTrash, openMessage, refreshLists, showView, syncNow, totalUnread, useMail } from '../state/mail'
import { currentMode, useMode } from '../state/settings'
import { setUi, uiStore, useUi } from '../state/ui'
import { Composer } from './Composer'
import { MessageList } from './MessageList'
import { Reader } from './Reader'
import { Sidebar } from './Sidebar'

const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

/** Keyboard: Strg+N new mail, F5 fetch, Entf to trash, arrow keys through the list. */
function useShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (document.querySelector('dialog[open]')) return
      const mod = navigator.userAgent.includes('Mac') ? event.metaKey : event.ctrlKey
      if (mod && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        void openCompose('new')
        return
      }
      if (event.key === 'F5') {
        event.preventDefault()
        void syncNow()
        return
      }
      if (isTyping(event.target) || uiStore.get().area !== 'mail') return
      const { messages, selectedId, detail } = mailStore.get()
      if (event.key === 'Delete' && selectedId !== null) {
        event.preventDefault()
        void moveToTrash(selectedId)
      } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && messages.length > 0) {
        event.preventDefault()
        const index = messages.findIndex((m) => m.id === selectedId)
        const next = messages[Math.min(messages.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))]
        if (next) void openMessage(next.id)
      } else if (event.key.toLowerCase() === 'r' && !mod && detail) {
        event.preventDefault()
        void openCompose(event.shiftKey && can('replyAll', currentMode()) ? 'replyAll' : 'reply', detail)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

/** The main screen: top bar with areas, then mail or calendar. */
export function Workspace(): React.JSX.Element {
  const mode = useMode()
  const ui = useUi()
  const mail = useMail()
  const compose = useCompose()
  const basic = mode === 'basic'
  const unread = totalUnread(mail)

  useShortcuts()
  useEffect(() => {
    void refreshLists()
    const off = listenToMain()
    const offOpen = window.relay.events.onOpenMessage((id) => {
      setUi({ area: 'mail' })
      void showView({ kind: 'all' }).then(() => openMessage(id))
    })
    const offClose = window.relay.window.onCloseRequested(async () => {
      if (await closeCompose()) window.relay.window.confirmClose()
    })
    return () => {
      off()
      offOpen()
      offClose()
    }
  }, [])

  useEffect(() => {
    document.title = t.app.windowTitle(unread)
  }, [unread])

  // Basic mode has no folder list; jump back to the inbox when switching.
  useEffect(() => {
    if (!can('folders', mode) && mail.view.kind !== 'all' && mail.view.kind !== 'trash') void showView({ kind: 'all' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const syncErrors = Object.keys(mail.sync.errors).length
  const status = mail.sync.syncing
    ? t.status.syncing
    : syncErrors > 0
      ? t.status.offline
      : mail.sync.lastSync
        ? t.status.lastSync(timeFormat.format(new Date(mail.sync.lastSync)))
        : ''

  return (
    <div className={`workspace workspace--${mode}`}>
      <header className="topbar">
        <div className="topbar__brand">
          <DulidanMark size={basic ? 34 : 26} tile title="" />
          <span className="topbar__name">{t.app.name}</span>
        </div>
        <Toolbar label={t.nav.label} className="topbar__nav">
          <IconButton icon={<Mail />} label={t.nav.mail} showLabel active={ui.area === 'mail'} onClick={() => setUi({ area: 'mail' })} />
          <IconButton icon={<CalendarDays />} label={t.nav.calendar} showLabel active={ui.area === 'calendar'} onClick={() => setUi({ area: 'calendar' })} />
        </Toolbar>
        <span className="toolbar__spacer" />
        <Toolbar label={t.nav.newMail} className="topbar__actions">
          <IconButton icon={<PenSquare />} label={t.nav.newMail} shortcut={shortcut('N')} showLabel onClick={() => void openCompose('new')} />
          <IconButton
            icon={<RefreshCw className={mail.sync.syncing ? 'is-spinning' : undefined} />}
            label={t.nav.refresh}
            shortcut="F5"
            showLabel={basic}
            disabled={mail.sync.syncing}
            onClick={() => void syncNow()}
          />
          <IconButton icon={<SettingsIcon />} label={t.nav.settings} showLabel={basic} onClick={() => setUi({ settingsOpen: true })} />
        </Toolbar>
      </header>

      {ui.area === 'mail' && basic && (
        <Toolbar label={t.nav.folders} className="basic-nav">
          <IconButton icon={<Inbox />} label={`${t.nav.inbox}${unread ? ` (${unread})` : ''}`} showLabel active={mail.view.kind === 'all'} onClick={() => void showView({ kind: 'all' })} />
          <IconButton icon={<Trash2 />} label={t.nav.trash} showLabel active={mail.view.kind === 'trash'} onClick={() => void showView({ kind: 'trash' })} />
        </Toolbar>
      )}

      <div className="workspace__body">
        {ui.area === 'mail' ? (
          <>
            {can('folders', mode) && <Sidebar />}
            <MessageList />
            <div className={cx('workspace__main', compose.open && 'has-composer')}>{compose.open ? <Composer /> : <Reader />}</div>
          </>
        ) : (
          <CalendarView />
        )}
      </div>

      <footer className="status-bar" role="status">
        <span>{status}</span>
      </footer>
    </div>
  )
}
