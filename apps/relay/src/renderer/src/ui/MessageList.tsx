import { useState } from 'react'
import { FileText, Paperclip, Search, X } from 'lucide-react'
import { cx, IconButton } from '@dulidan/design-system'
import { can } from '../features'
import { t } from '../i18n'
import { displayName } from '../mail/addresses'
import { openDraft } from '../state/compose'
import { openMessage, showView, useMail } from '../state/mail'
import { useAccounts, useMode } from '../state/settings'

const today = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
const older = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Berlin' })

function shortDate(ms: number): string {
  const date = new Date(ms)
  return date.toDateString() === new Date().toDateString() ? today.format(date) : older.format(date)
}

export function MessageList(): React.JSX.Element {
  const { view, messages, drafts, selectedId, folders } = useMail()
  const mode = useMode()
  const accounts = useAccounts()
  const [query, setQuery] = useState(view.kind === 'search' ? view.query : '')
  const multiAccount = accounts.length > 1
  // In "Gesendet" the recipient is more useful than the sender (that is me).
  const sentView =
    view.kind === 'folder' && (folders[view.accountId]?.some((folder) => folder.path === view.path && folder.specialUse === 'sent') ?? false)

  return (
    <section className="message-list" aria-label={t.list.label}>
      {can('search', mode) && (
        <form
          className="message-list__search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            if (query.trim()) void showView({ kind: 'search', query: query.trim() })
          }}
        >
          <Search aria-hidden="true" />
          <input
            className="message-list__search-input"
            aria-label={t.list.searchPlaceholder}
            placeholder={t.list.searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              // An emptied search field shows all mails again.
              if (!event.target.value && view.kind === 'search') void showView({ kind: 'all' })
            }}
          />
          {view.kind === 'search' && (
            <IconButton
              icon={<X />}
              label={t.dialogs.close}
              onClick={() => {
                setQuery('')
                void showView({ kind: 'all' })
              }}
            />
          )}
        </form>
      )}
      {view.kind === 'search' && (
        <p className="message-list__info">
          {t.list.searchResults(messages.length)} · {t.list.searchHint}
        </p>
      )}

      {view.kind === 'drafts' ? (
        <ul className="message-list__items" role="listbox" aria-label={t.nav.localDrafts}>
          {drafts.length === 0 && <li className="message-list__empty">{t.list.empty}</li>}
          {drafts.map((draft) => (
            <li key={draft.id} role="option" aria-selected={false}>
              <button type="button" className="message-row" onClick={() => openDraft(draft)}>
                <FileText aria-hidden="true" className="message-row__icon" />
                <span className="message-row__from">
                  {t.list.to} {draft.to || '—'}
                </span>
                <span className="message-row__date">{shortDate(draft.updatedAt)}</span>
                <span className="message-row__subject">{draft.subject || t.list.noSubject}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="message-list__items" role="listbox" aria-label={t.list.label}>
          {messages.length === 0 && <li className="message-list__empty">{t.list.empty}</li>}
          {messages.map((message) => {
            const account = multiAccount ? accounts.find((item) => item.id === message.accountId) : undefined
            return (
              <li key={message.id} role="option" aria-selected={message.id === selectedId}>
                <button
                  type="button"
                  className={cx('message-row', !message.seen && 'is-unread', message.id === selectedId && 'is-selected')}
                  onClick={() => void openMessage(message.id)}
                  aria-label={`${message.seen ? '' : `${t.list.unread}: `}${displayName(message.from) || t.list.unknownSender}, ${message.subject || t.list.noSubject}`}
                >
                  {!message.seen && <span className="message-row__dot" aria-hidden="true" />}
                  <span className="message-row__from">
                    {sentView ? `${t.list.to} ${message.to.map((entry) => displayName(entry)).join(', ')}` : displayName(message.from) || t.list.unknownSender}
                  </span>
                  <span className="message-row__date">{shortDate(message.date)}</span>
                  <span className="message-row__subject">
                    {message.hasAttachments && <Paperclip aria-label={t.list.attachment} className="message-row__clip" />}
                    {message.subject || t.list.noSubject}
                  </span>
                  <span className="message-row__snippet">{message.snippet}</span>
                  {account && <span className="message-row__account">{account.email}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
