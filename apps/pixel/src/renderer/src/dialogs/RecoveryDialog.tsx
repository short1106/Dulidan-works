import { ImageUp } from 'lucide-react'
import { Button, Dialog } from '@dulidan/design-system'
import { t } from '../i18n'
import { confirmLeave, showOpened } from '../state/session'
import type { RecoverableEntry } from '../../../shared/ipc'

const timeFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

interface Props {
  entries: RecoverableEntry[]
  onChange: (entries: RecoverableEntry[]) => void
}

/** After a crash: offer the pictures that were not saved. */
export function RecoveryDialog({ entries, onChange }: Props): React.JSX.Element | null {
  if (entries.length === 0) return null
  const remove = (docId: string): void => onChange(entries.filter((entry) => entry.docId !== docId))

  const restore = async (entry: RecoverableEntry): Promise<void> => {
    if (!(await confirmLeave())) return
    const result = await window.pixel.recovery.load(entry.docId)
    if (await showOpened(result, { keepDirty: true, docId: entry.docId })) remove(entry.docId)
  }

  return (
    <Dialog
      open
      title={t.recovery.title}
      onClose={() => onChange([])}
      actions={
        <Button
          variant="ghost"
          onClick={() => {
            entries.forEach((entry) => void window.pixel.recovery.discard(entry.docId))
            onChange([])
          }}
        >
          {t.recovery.discardAll}
        </Button>
      }
    >
      <p>{t.recovery.text}</p>
      <ul className="recovery-list">
        {entries.map((entry) => (
          <li key={entry.docId} className="recovery-list__item">
            <ImageUp aria-hidden="true" />
            <span className="recovery-list__text">
              <strong>{entry.title || t.app.untitled}</strong>
              <br />
              <small>{t.recovery.savedAt(timeFormat.format(new Date(entry.updatedAt)))}</small>
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                void window.pixel.recovery.discard(entry.docId)
                remove(entry.docId)
              }}
            >
              {t.recovery.discard}
            </Button>
            <Button variant="primary" onClick={() => void restore(entry)}>
              {t.recovery.restore}
            </Button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
