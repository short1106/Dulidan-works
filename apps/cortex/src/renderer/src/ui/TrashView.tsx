import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { ask, Button } from '@dulidan/design-system'
import type { TrashEntry } from '../../../shared/ipc'
import { t } from '../i18n'
import { deleteForGood, restoreFromTrash, showView, useNotes } from '../state/notes'
import { useMode } from '../state/settings'
import { shortDate } from './NoteItems'

async function confirmDelete(entry: TrashEntry): Promise<void> {
  const answer = await ask({
    title: t.trash.deleteTitle,
    text: t.trash.deleteText(entry.title),
    cancelValue: 'no',
    choices: [
      { value: 'no', label: t.dialogs.cancel, variant: 'ghost' },
      { value: 'yes', label: t.trash.deleteForGood, variant: 'primary' }
    ]
  })
  if (answer === 'yes') await deleteForGood(entry)
}

/** The trash: restore, or delete for good after 30 days. */
export function TrashView(): React.JSX.Element {
  const { trash } = useNotes()
  const basic = useMode() === 'basic'
  return (
    <section className="trash-view" aria-label={t.trash.title}>
      <header className="trash-view__head">
        {basic && (
          <Button icon={<ArrowLeft />} onClick={() => showView({ kind: 'all' })}>
            {t.nav.back}
          </Button>
        )}
        <h1 className="trash-view__title">{t.trash.title}</h1>
      </header>
      <p className="hint">{t.trash.info}</p>
      {trash.length === 0 ? (
        <p className="empty-hint">{t.trash.empty}</p>
      ) : (
        <ul className="trash-list">
          {trash.map((entry) => (
            <li key={entry.path} className="trash-item">
              <div className="trash-item__info">
                <span className="trash-item__title">{entry.title}</span>
                <span className="trash-item__meta">
                  {shortDate(entry.deleted)} · {entry.daysLeft > 0 ? t.trash.daysLeft(entry.daysLeft) : t.trash.canDelete}
                  {!basic && entry.original.includes('/') && ` · ${t.trash.from(entry.original.slice(0, entry.original.lastIndexOf('/')))}`}
                </span>
              </div>
              <div className="trash-item__actions">
                <Button icon={<RotateCcw />} onClick={() => void restoreFromTrash(entry)}>
                  {t.trash.restore}
                </Button>
                <Button icon={<Trash2 />} variant="ghost" disabled={entry.daysLeft > 0} title={entry.daysLeft > 0 ? t.trash.daysLeft(entry.daysLeft) : undefined} onClick={() => void confirmDelete(entry)}>
                  {t.trash.deleteForGood}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
