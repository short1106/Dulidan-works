import { useEffect, useState } from 'react'
import { Briefcase, Feather, FolderOpen, Sparkles } from 'lucide-react'
import { Button, cx, Dialog, notify, TextField } from '@dulidan/design-system'
import { BASIC_FONT_SCALES, type BasicFontScale, type Mode } from '@dulidan/core'
import type { AppInfo, VaultInfo } from '../../../shared/ipc'
import { t } from '../i18n'
import { moveCurrent, useNote } from '../state/note'
import { errorText, refreshLists, showView, useNotes } from '../state/notes'
import { updateSettings, useSettings } from '../state/settings'
import { setUi, useUi } from '../state/ui'

export const MODE_CARDS: Array<{ mode: Mode; icon: React.JSX.Element; name: string; text: string }> = [
  { mode: 'basic', icon: <Feather />, name: t.modes.basic.name, text: t.modes.basic.text },
  { mode: 'expert', icon: <Briefcase />, name: t.modes.expert.name, text: t.modes.expert.text },
  { mode: 'pro', icon: <Sparkles />, name: t.modes.pro.name, text: t.modes.pro.text }
]

const FONT_LABELS: Record<BasicFontScale, string> = { 1: t.settings.fontNormal, 1.15: t.settings.fontLarge, 1.3: t.settings.fontXLarge }

function OptionGroup<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string; description?: string }>
  onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <fieldset className="settings__group">
      <legend className="settings__legend">{label}</legend>
      <div className="settings__options">
        {options.map((option) => (
          <label key={String(option.value)} className={cx('settings__option', option.value === value && 'is-selected')}>
            <input type="radio" name={label} checked={option.value === value} onChange={() => onChange(option.value)} />
            <span className="settings__option-label">{option.label}</span>
            {option.description && <span className="settings__option-text">{option.description}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function SettingsDialog(): React.JSX.Element {
  const { settingsOpen } = useUi()
  const settings = useSettings()
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [vault, setVault] = useState<VaultInfo | null>(null)
  useEffect(() => {
    if (!settingsOpen) return
    void window.cortex.app.info().then(setInfo)
    void window.cortex.vault.info().then(setVault)
  }, [settingsOpen, settings.mode])
  const close = (): void => setUi({ settingsOpen: false })
  const advanced = settings.mode === 'expert' || settings.mode === 'pro'

  return (
    <Dialog open={settingsOpen} title={t.settings.title} onClose={close} className="settings" actions={<Button variant="primary" onClick={close}>{t.dialogs.close}</Button>}>
      <OptionGroup
        label={t.settings.mode}
        value={settings.mode ?? 'basic'}
        options={MODE_CARDS.map((card) => ({ value: card.mode, label: card.name, description: card.text }))}
        onChange={(mode) => void updateSettings({ mode }).then(() => refreshLists())}
      />
      <fieldset className="settings__group">
        <legend className="settings__legend">{t.settings.notesFolder}</legend>
        <p className="settings__path">{vault?.root}</p>
        <p className="hint">{t.settings.notesFolderHint}</p>
        <div className="settings__row">
          <Button
            icon={<FolderOpen />}
            onClick={() =>
              void window.cortex.vault.choose().then((next) => {
                if (!next) return
                setVault(next)
                notify(t.settings.folderChanged, 'success')
              })
            }
          >
            {t.settings.chooseFolder}
          </Button>
          <Button onClick={() => void window.cortex.vault.openInExplorer()}>{t.settings.showFolder}</Button>
          {advanced && (
            <Button
              onClick={() =>
                void window.cortex.vault.rebuildIndex().then((count) => {
                  notify(t.settings.rebuilt(count), 'success')
                  void refreshLists()
                })
              }
            >
              {t.settings.rebuild}
            </Button>
          )}
        </div>
        {advanced && <p className="hint">{t.settings.rebuildHint}</p>}
      </fieldset>
      {advanced && info && (
        <fieldset className="settings__group">
          <legend className="settings__legend">{t.settings.quickNote}</legend>
          <p className="hint">{info.quickNoteActive ? t.settings.quickNoteInfo(info.quickNoteShortcut) : t.settings.quickNoteBusy(info.quickNoteShortcut)}</p>
        </fieldset>
      )}
      <OptionGroup
        label={t.settings.theme}
        value={settings.theme}
        options={[
          { value: 'dark', label: t.settings.dark },
          { value: 'light', label: t.settings.light }
        ]}
        onChange={(theme) => void updateSettings({ theme })}
      />
      <OptionGroup
        label={t.settings.animations}
        value={settings.animations}
        options={[
          { value: true, label: t.settings.on },
          { value: false, label: t.settings.off }
        ]}
        onChange={(animations) => void updateSettings({ animations })}
      />
      <OptionGroup
        label={t.settings.basicFontSize}
        value={settings.basicFontScale}
        options={BASIC_FONT_SCALES.map((scale) => ({ value: scale, label: FONT_LABELS[scale] }))}
        onChange={(basicFontScale) => void updateSettings({ basicFontScale })}
      />
      <p className="settings__about">{t.settings.about(info?.version ?? '')}</p>
    </Dialog>
  )
}

/** New folder or new folder name. */
export function FolderDialog(): React.JSX.Element | null {
  const { folderDialog } = useUi()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    setName(folderDialog?.kind === 'rename' ? folderDialog.path.slice(folderDialog.path.lastIndexOf('/') + 1) : '')
  }, [folderDialog])
  if (!folderDialog) return null
  const close = (): void => setUi({ folderDialog: null })
  const submit = async (): Promise<void> => {
    if (!name.trim()) return
    const result =
      folderDialog.kind === 'new' ? await window.cortex.folders.create(folderDialog.parent, name) : await window.cortex.folders.rename(folderDialog.path, name)
    if (!result.ok) return setError(result.error === 'exists' ? t.folders.exists : errorText(result.error))
    close()
    showView({ kind: 'folder', path: result.value })
    await refreshLists()
  }
  return (
    <Dialog
      open
      title={folderDialog.kind === 'new' ? t.folders.newTitle : t.folders.renameTitle}
      onClose={close}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            {t.dialogs.cancel}
          </Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => void submit()}>
            {folderDialog.kind === 'new' ? t.folders.create : t.folders.save}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {folderDialog.kind === 'new' && folderDialog.parent && <p className="hint">{t.note.folderIn(folderDialog.parent)}</p>}
        <TextField label={t.folders.name} value={name} autoFocus onChange={(event) => setName(event.target.value)} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

/** Move the open note into another folder. */
export function MoveDialog(): React.JSX.Element | null {
  const { moveDialog } = useUi()
  const { folders } = useNotes()
  const { current } = useNote()
  const currentFolder = current?.path.includes('/') ? current.path.slice(0, current.path.lastIndexOf('/')) : ''
  const [target, setTarget] = useState(currentFolder)
  useEffect(() => setTarget(currentFolder), [moveDialog, currentFolder])
  if (!moveDialog || !current) return null
  const close = (): void => setUi({ moveDialog: false })
  const choices = ['', ...folders.folders]
  return (
    <Dialog
      open
      title={t.folders.moveTitle}
      onClose={close}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            {t.dialogs.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={target === currentFolder}
            onClick={() => {
              close()
              void moveCurrent(target)
            }}
          >
            {t.folders.moveAction}
          </Button>
        </>
      }
    >
      <fieldset className="settings__group">
        <legend className="settings__legend">{t.folders.moveText}</legend>
        <div className="move-list">
          {choices.map((folder) => (
            <label key={folder || '/'} className={cx('settings__option', target === folder && 'is-selected')} style={{ paddingLeft: 12 + (folder ? folder.split('/').length - 1 : 0) * 16 }}>
              <input type="radio" name="move-target" checked={target === folder} onChange={() => setTarget(folder)} />
              <span className="settings__option-label">{folder ? folder.slice(folder.lastIndexOf('/') + 1) : t.nav.topLevel}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  )
}
