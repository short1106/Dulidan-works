import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { Button, Dialog } from '@dulidan/design-system'
import { t } from '../i18n'
import { restoreSnapshot, snapshotIfChanged, useSession } from '../state/document'
import { setUi, useUi } from '../state/ui'
import type { SnapshotInfoLike } from '../../../shared/ipc'

const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })

/** "Heute, 10:32:15" or "Mo., 3. Nov., 10:32:15" */
export function formatSnapshotTime(iso: string): string {
  const date = new Date(iso)
  const today = new Date().toDateString() === date.toDateString()
  return `${today ? 'Heute' : dateFormat.format(date)}, ${timeFormat.format(date)}`
}

/** "Frühere Stände": go back to one of the last ten autosaves. */
export function VersionsDialog(): React.JSX.Element {
  const { versionsOpen } = useUi()
  const session = useSession()
  const [snapshots, setSnapshots] = useState<SnapshotInfoLike[] | null>(null)

  useEffect(() => {
    if (!versionsOpen) return
    setSnapshots(null)
    // Save the current state first, so it can be returned to as well.
    void snapshotIfChanged()
      .then(() => window.glyph.recovery.list(session.docId))
      .then(setSnapshots)
  }, [versionsOpen, session.docId])

  const close = (): void => setUi({ versionsOpen: false })

  return (
    <Dialog
      open={versionsOpen}
      title={t.versions.title}
      onClose={close}
      actions={<Button onClick={close}>{t.dialogs.close}</Button>}
    >
      <p>{t.versions.text}</p>
      {snapshots && snapshots.length === 0 && <p className="versions__empty">{t.versions.empty}</p>}
      {snapshots && snapshots.length > 0 && (
        <ul className="versions">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id} className="versions__item">
              <History aria-hidden="true" />
              <span className="versions__time">{formatSnapshotTime(snapshot.savedAt)}</span>
              <Button
                onClick={async () => {
                  if (await restoreSnapshot(snapshot.id)) close()
                }}
              >
                {t.versions.restore}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
