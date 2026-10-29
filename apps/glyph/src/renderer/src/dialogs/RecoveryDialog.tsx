import { FileClock } from 'lucide-react'
import { Button, Dialog } from '@dulidan/design-system'
import { t } from '../i18n'
import { showOpenedDocument, confirmLeave } from '../state/document'
import type { RecoverableEntry } from '../../../shared/ipc'
import { formatSnapshotTime } from './VersionsDialog'

interface Props {
  entries: RecoverableEntry[]
  onChange: (entries: RecoverableEntry[]) => void
}

/** After a crash: offer the documents that were not saved. */
export function RecoveryDialog({ entries, onChange }: Props): React.JSX.Element | null {
  if (entries.length === 0) return null

  const remove = (docId: string): void => onChange(entries.filter((entry) => entry.docId !== docId))

  const restore = async (entry: RecoverableEntry): Promise<void> => {
    if (!(await confirmLeave())) return
    const result = await window.glyph.recovery.load(entry.docId)
    // Keep the id, so the restored document continues its snapshots.
    if (showOpenedDocument(result, { keepDirty: true, docId: entry.docId })) remove(entry.docId)
  }

  const discard = (entry: RecoverableEntry): void => {
    void window.glyph.recovery.discard(entry.docId)
    remove(entry.docId)
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
            entries.forEach((entry) => void window.glyph.recovery.discard(entry.docId))
            onChange([])
          }}
        >
          {t.recovery.later}
        </Button>
      }
    >
      <p>{t.recovery.text}</p>
      <ul className="versions">
        {entries.map((entry) => (
          <li key={entry.docId} className="versions__item">
            <FileClock aria-hidden="true" />
            <span className="versions__time">
              <strong>{entry.title || t.app.untitled}</strong>
              <br />
              <small>{t.recovery.savedAt(formatSnapshotTime(entry.updatedAt))}</small>
            </span>
            <Button variant="ghost" onClick={() => discard(entry)}>
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
