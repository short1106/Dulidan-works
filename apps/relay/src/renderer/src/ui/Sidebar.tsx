import { Archive, FileText, Folder, Inbox, Mails, Send, ShieldAlert, Trash2, type LucideIcon } from 'lucide-react'
import { cx } from '@dulidan/design-system'
import type { FolderInfo } from '../../../shared/ipc'
import { t } from '../i18n'
import { showView, useMail, type MailboxView } from '../state/mail'
import { useAccounts } from '../state/settings'

const ICONS: Record<string, LucideIcon> = { inbox: Inbox, sent: Send, drafts: FileText, trash: Trash2, junk: ShieldAlert, archive: Archive }

export function folderLabel(folder: Pick<FolderInfo, 'specialUse' | 'name'>): string {
  return folder.specialUse ? t.folders[folder.specialUse] : folder.name
}

function sameView(a: MailboxView, b: MailboxView): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'folder' && b.kind === 'folder') return a.accountId === b.accountId && a.path === b.path
  return true
}

/** Expert mode: all inboxes, then each account with its folders, then local drafts. */
export function Sidebar(): React.JSX.Element {
  const { view, folders, drafts, sync } = useMail()
  const accounts = useAccounts()
  const allUnread = Object.values(folders)
    .flat()
    .filter((folder) => folder.specialUse === 'inbox')
    .reduce((sum, folder) => sum + folder.unread, 0)

  const item = (target: MailboxView, label: string, Icon: LucideIcon, count?: number): React.JSX.Element => (
    <li key={JSON.stringify(target)}>
      <button type="button" className={cx('nav-item', sameView(view, target) && 'is-active')} aria-current={sameView(view, target) ? 'true' : undefined} onClick={() => void showView(target)}>
        <Icon aria-hidden="true" />
        <span className="nav-item__label">{label}</span>
        {count ? <span className="nav-item__count">{count}</span> : null}
      </button>
    </li>
  )

  return (
    <nav className="sidebar" aria-label={t.nav.folders}>
      <ul className="sidebar__list">
        {item({ kind: 'all' }, t.nav.allInboxes, Mails, allUnread)}
        {item({ kind: 'drafts' }, t.nav.localDrafts, FileText, drafts.length)}
      </ul>
      {accounts.map((account) => (
        <section key={account.id} className="sidebar__account">
          <h2 className="sidebar__account-title" title={account.email}>
            {account.email}
            {sync.errors[account.id] && <span className="sidebar__error" title={t.status.offline}>!</span>}
          </h2>
          <ul className="sidebar__list">
            {(folders[account.id] ?? []).map((folder) =>
              item({ kind: 'folder', accountId: account.id, path: folder.path }, folderLabel(folder), ICONS[folder.specialUse ?? ''] ?? Folder, folder.specialUse === 'sent' || folder.specialUse === 'trash' ? 0 : folder.unread)
            )}
          </ul>
        </section>
      ))}
    </nav>
  )
}
