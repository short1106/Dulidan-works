import { useRef } from 'react'
import { ListChecks, Pin, Search, X } from 'lucide-react'
import { cx, IconButton } from '@dulidan/design-system'
import { ATTACHMENT_URL } from '@dulidan/notes-core'
import { cardColor } from '../cards'
import type { NoteSummary, SearchHit } from '../../../shared/ipc'
import { t } from '../i18n'
import { openNote } from '../state/note'
import { isSearchHit, setQuery, useNotes } from '../state/notes'

const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function shortDate(iso: string): string {
  const date = new Date(iso)
  return date.toDateString() === new Date().toDateString() ? `${timeFormat.format(date)} Uhr` : dateFormat.format(date)
}

/** Search hit text: the found words are between \u0001 and \u0002. */
export function Highlighted({ text }: { text: string }): React.JSX.Element {
  const parts = text.split(/(\u0001[^\u0002]*\u0002)/)
  return (
    <>
      {parts.map((part, index) => (part.startsWith('\u0001') ? <mark key={index}>{part.slice(1, -1)}</mark> : <span key={index}>{part}</span>))}
    </>
  )
}

function Preview({ item }: { item: NoteSummary | SearchHit }): React.JSX.Element {
  if (isSearchHit(item) && item.snippet) return <Highlighted text={item.snippet} />
  return <>{item.excerpt || t.list.emptyNote}</>
}

function Tasks({ item }: { item: NoteSummary }): React.JSX.Element | null {
  if (item.tasksTotal === 0) return null
  return (
    <span className="tasks">
      <ListChecks aria-hidden="true" />
      {t.list.tasks(item.tasksDone, item.tasksTotal)}
    </span>
  )
}

export function SearchField({ large = false }: { large?: boolean }): React.JSX.Element {
  const { query } = useNotes()
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className={cx('search-field', large && 'search-field--large')} role="search">
      <Search aria-hidden="true" />
      <input
        ref={ref}
        className="search-field__input"
        type="search"
        aria-label={t.list.searchPlaceholder}
        placeholder={t.list.searchPlaceholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query) {
            event.stopPropagation()
            setQuery('')
          }
        }}
      />
      {query && (
        <IconButton
          icon={<X />}
          label={t.dialogs.close}
          onClick={() => {
            setQuery('')
            ref.current?.focus()
          }}
        />
      )}
    </div>
  )
}

/** Notes as colorful cards ("Zettel"). In basic mode every card has a color. */
export function CardGrid({ items, selected, emptyText, colorful = false }: { items: Array<NoteSummary | SearchHit>; selected: string | null; emptyText: string; colorful?: boolean }): React.JSX.Element {
  if (items.length === 0) return <p className="empty-hint">{emptyText}</p>
  return (
    <ul className="card-grid" aria-label={t.list.label}>
      {items.map((item) => (
        <li key={item.path}>
          <button
            type="button"
            className={cx('note-card', (colorful || item.color) && `note-card--${cardColor(item)}`, item.path === selected && 'is-selected')}
            aria-current={item.path === selected ? 'true' : undefined}
            onClick={() => void openNote(item.path)}
          >
            {item.image && <img className="note-card__image" src={ATTACHMENT_URL + encodeURIComponent(item.image)} alt="" />}
            <span className="note-card__head">
              <span className="note-card__title">{item.title}</span>
              {item.pinned && <Pin className="note-card__pin" aria-label={t.list.pinned} />}
            </span>
            <span className="note-card__text">
              <Preview item={item} />
            </span>
            <span className="note-card__foot">
              <Tasks item={item} />
              <span className="note-card__date">{shortDate(item.modified)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Notes as a compact list (expert mode). Arrow keys move through it. */
export function NoteList({ items, selected, emptyText, showFolder }: { items: Array<NoteSummary | SearchHit>; selected: string | null; emptyText: string; showFolder: boolean }): React.JSX.Element {
  if (items.length === 0) return <p className="empty-hint">{emptyText}</p>
  return (
    <ul
      className="note-list"
      role="listbox"
      aria-label={t.list.label}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        const index = items.findIndex((item) => item.path === selected)
        const next = items[Math.min(items.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))]
        if (!next) return
        void openNote(next.path)
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-path="${CSS.escape(next.path)}"]`)?.focus())
      }}
    >
      {items.map((item) => (
        <li
          key={item.path}
          role="option"
          data-path={item.path}
          aria-selected={item.path === selected}
          tabIndex={item.path === selected || (!selected && item === items[0]) ? 0 : -1}
          className={cx('note-row', item.path === selected && 'is-selected')}
          onClick={() => void openNote(item.path)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void openNote(item.path)
          }}
        >
          <span className="note-row__head">
            {item.color && <span className={cx('swatch', `swatch--${item.color}`)} aria-hidden="true" />}
            <span className="note-row__title">{item.title}</span>
            {item.pinned && <Pin className="note-row__pin" aria-label={t.list.pinned} />}
            <span className="note-row__date">{shortDate(item.modified)}</span>
          </span>
          <span className="note-row__text">
            <Preview item={item} />
          </span>
          {(showFolder && item.folder) || item.tags.length > 0 || item.tasksTotal > 0 ? (
            <span className="note-row__meta">
              {showFolder && item.folder && <span className="chip chip--folder">{item.folder}</span>}
              {item.tags.map((tag) => (
                <span key={tag} className="chip">
                  #{tag}
                </span>
              ))}
              <Tasks item={item} />
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
