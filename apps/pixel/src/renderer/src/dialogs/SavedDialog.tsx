import { useSyncExternalStore } from 'react'
import { CircleCheck, FolderOpen } from 'lucide-react'
import { Button, Dialog } from '@dulidan/design-system'
import { t } from '../i18n'
import { savedInfoStore } from '../state/session'

/** Basic mode: after saving, say clearly where the file is. */
export function SavedDialog(): React.JSX.Element | null {
  const info = useSyncExternalStore(savedInfoStore.subscribe, savedInfoStore.get)
  if (!info) return null
  const close = (): void => savedInfoStore.set(null)
  return (
    <Dialog
      open
      title={t.dialogs.savedTitle}
      onClose={close}
      className="saved-dialog"
      actions={
        <>
          <Button icon={<FolderOpen />} onClick={() => void window.pixel.file.showInFolder(info.filePath)}>
            {t.dialogs.showFolder}
          </Button>
          <Button variant="primary" autoFocus onClick={close}>
            {t.dialogs.ok}
          </Button>
        </>
      }
    >
      <p className="saved-dialog__text">
        <CircleCheck className="saved-dialog__icon" aria-hidden="true" />
        {t.dialogs.savedText(info.name, info.folder)}
      </p>
    </Dialog>
  )
}
