import { Folder, FolderPlus, Hash, Inbox, MoreHorizontal, NotebookText, Pin, Trash2 } from 'lucide-react'
import { ask, cx, DropdownMenu, IconButton, notify } from '@dulidan/design-system'
import { INBOX_DIR } from '@dulidan/notes-core'
import { t } from '../i18n'
import { errorText, refreshLists, showView, useNotes, type ListView } from '../state/notes'
import { setUi } from '../state/ui'

function sameView(a: ListView, b: ListView): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'folder' && b.kind === 'folder') return a.path === b.path
  if (a.kind === 'tag' && b.kind === 'tag') return a.tag === b.tag
  return true
}

function NavItem({ view, icon, label, count, depth = 0 }: { view: ListView; icon: React.JSX.Element; label: string; count?: number; depth?: number }): React.JSX.Element {
  const { view: current } = useNotes()
  const active = sameView(view, current)
  return (
    <button
      type="button"
      className={cx('nav-item', active && 'is-active')}
      aria-current={active ? 'page' : undefined}
      style={depth ? { paddingLeft: 10 + depth * 16 } : undefined}
      onClick={() => showView(view)}
    >
      {icon}
      <span className="nav-item__label">{label}</span>
      {count !== undefined && count > 0 && <span className="nav-item__count">{count}</span>}
    </button>
  )
}

async function removeFolder(path: string): Promise<void> {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const answer = await ask({
    title: t.folders.removeTitle,
    text: t.folders.removeText(name),
    cancelValue: 'no',
    choices: [
      { value: 'no', label: t.dialogs.cancel, variant: 'ghost' },
      { value: 'yes', label: t.nav.removeFolder, variant: 'primary' }
    ]
  })
  if (answer !== 'yes') return
  const result = await window.cortex.folders.remove(path)
  if (!result.ok) return notify(result.error === 'folder-not-empty' ? t.folders.notEmpty : errorText(result.error), 'error')
  showView({ kind: 'all' })
  await refreshLists()
}

/** Expert mode: all notes, pinned, folders (nested), tags and the trash. */
export function Sidebar(): React.JSX.Element {
  const { folders, tags, trash } = useNotes()
  const total = Object.values(folders.counts).reduce((sum, count) => sum + count, 0)

  return (
    <nav className="sidebar" aria-label={t.nav.label}>
      <div className="sidebar__list">
        <NavItem view={{ kind: 'all' }} icon={<NotebookText />} label={t.nav.all} count={total} />
        <NavItem view={{ kind: 'pinned' }} icon={<Pin />} label={t.nav.pinned} />
      </div>

      <div className="sidebar__section">
        <div className="sidebar__section-head">
          <h2 className="sidebar__title">{t.nav.folders}</h2>
          <IconButton icon={<FolderPlus />} label={t.nav.newFolder} onClick={() => setUi({ folderDialog: { kind: 'new', parent: '' } })} />
        </div>
        <ul className="sidebar__list">
          {folders.folders.map((path) => {
            const depth = path.split('/').length - 1
            const name = path.slice(path.lastIndexOf('/') + 1)
            return (
              <li key={path} className="folder-row">
                <NavItem view={{ kind: 'folder', path }} icon={path === INBOX_DIR ? <Inbox /> : <Folder />} label={name} count={folders.counts[path]} depth={depth} />
                <DropdownMenu
                  label={t.nav.folderActions(name)}
                  triggerClassName="dd-icon-button folder-row__menu"
                  trigger={<MoreHorizontal aria-hidden="true" />}
                  items={[
                    { id: 'sub', label: t.nav.subfolder, onSelect: () => setUi({ folderDialog: { kind: 'new', parent: path } }) },
                    { id: 'rename', label: t.nav.renameFolder, onSelect: () => setUi({ folderDialog: { kind: 'rename', path } }) },
                    { id: 'remove', label: t.nav.removeFolder, onSelect: () => void removeFolder(path) }
                  ]}
                />
              </li>
            )
          })}
        </ul>
      </div>

      {tags.length > 0 && (
        <div className="sidebar__section">
          <h2 className="sidebar__title">{t.nav.tags}</h2>
          <ul className="sidebar__list">
            {tags.map(({ tag, count }) => (
              <li key={tag}>
                <NavItem view={{ kind: 'tag', tag }} icon={<Hash />} label={tag} count={count} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="sidebar__section sidebar__bottom">
        <NavItem view={{ kind: 'trash' }} icon={<Trash2 />} label={t.nav.trash} count={trash.length} />
      </div>
    </nav>
  )
}
