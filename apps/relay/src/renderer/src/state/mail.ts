import { useSyncExternalStore } from 'react'
import { notify } from '@dulidan/design-system'
import { createStore } from '@dulidan/core'
import type { Draft, FolderInfo, MailErrorCode, MessageDetail, MessageSummary, SyncState } from '../../../shared/ipc'
import { t } from '../i18n'

/**
 * What the mail area shows: which mailbox, which list, which mail.
 *   { kind: 'all' }                      inboxes of all accounts
 *   { kind: 'trash' }                    trash folders of all accounts (basic mode)
 *   { kind: 'folder', accountId, path }  one folder
 *   { kind: 'drafts' }                   local drafts
 *   { kind: 'search', query }            search results
 */
export type MailboxView =
  | { kind: 'all' }
  | { kind: 'trash' }
  | { kind: 'folder'; accountId: string; path: string }
  | { kind: 'drafts' }
  | { kind: 'search'; query: string }

export interface MailState {
  view: MailboxView
  folders: Record<string, FolderInfo[]>
  messages: MessageSummary[]
  drafts: Draft[]
  selectedId: number | null
  detail: MessageDetail | null
  loadingDetail: boolean
  sync: SyncState
}

export const mailStore = createStore<MailState>({
  view: { kind: 'all' },
  folders: {},
  messages: [],
  drafts: [],
  selectedId: null,
  detail: null,
  loadingDetail: false,
  sync: { syncing: false, errors: {}, lastSync: null }
})

export const useMail = (): MailState => useSyncExternalStore(mailStore.subscribe, mailStore.get)

export function errorText(code: MailErrorCode): string {
  return t.errors[code] ?? t.errors.unknown
}

/** Reloads folders and the current list from the local copy (fast, no network). */
export async function refreshLists(): Promise<void> {
  const { view } = mailStore.get()
  const accounts = await window.relay.accounts.list()
  const folders: Record<string, FolderInfo[]> = {}
  for (const account of accounts) folders[account.id] = await window.relay.mail.folders(account.id)
  let messages: MessageSummary[] = []
  if (view.kind === 'all') messages = await window.relay.mail.allInboxes()
  else if (view.kind === 'folder') messages = await window.relay.mail.messages(view.accountId, view.path)
  else if (view.kind === 'search') messages = await window.relay.mail.search(view.query)
  else if (view.kind === 'trash') {
    for (const account of accounts) {
      const trash = folders[account.id]?.find((folder) => folder.specialUse === 'trash')
      if (trash) messages.push(...(await window.relay.mail.messages(account.id, trash.path)))
    }
    messages.sort((a, b) => b.date - a.date)
  }
  const drafts = await window.relay.drafts.list()
  mailStore.set((state) => {
    // A selected mail that is gone (moved elsewhere) is deselected.
    const stillThere = state.selectedId === null || messages.some((m) => m.id === state.selectedId) || view.kind === 'drafts'
    return {
      ...state,
      folders,
      messages,
      drafts,
      selectedId: stillThere ? state.selectedId : null,
      detail: stillThere ? state.detail : null
    }
  })
}

export async function showView(view: MailboxView): Promise<void> {
  mailStore.set((state) => ({ ...state, view, selectedId: null, detail: null, messages: [] }))
  await refreshLists()
  // Fetch the opened folder too, so it is up to date.
  if (view.kind === 'folder') void window.relay.mail.sync(view.accountId, view.path)
}

/** Opens a mail; it is marked as read. */
export async function openMessage(id: number): Promise<void> {
  mailStore.set((state) => ({ ...state, selectedId: id, detail: null, loadingDetail: true }))
  const result = await window.relay.mail.message(id)
  if (mailStore.get().selectedId !== id) return
  if (!result.ok) {
    mailStore.set((state) => ({ ...state, loadingDetail: false }))
    notify(errorText(result.error), 'error')
    return
  }
  mailStore.set((state) => ({
    ...state,
    detail: { ...result.value, seen: true },
    loadingDetail: false,
    messages: state.messages.map((m) => (m.id === id ? { ...m, seen: true } : m))
  }))
  if (!result.value.seen) {
    const seen = await window.relay.mail.setSeen(id, true)
    if (!seen.ok) notify(errorText(seen.error), 'error')
    void refreshLists()
  }
}

export async function markUnread(id: number): Promise<void> {
  const result = await window.relay.mail.setSeen(id, false)
  if (!result.ok) notify(errorText(result.error), 'error')
  mailStore.set((state) => ({ ...state, selectedId: null, detail: null }))
  await refreshLists()
}

export async function moveToTrash(id: number): Promise<void> {
  const index = mailStore.get().messages.findIndex((m) => m.id === id)
  const result = await window.relay.mail.moveToTrash(id)
  if (!result.ok) {
    notify(errorText(result.error), 'error')
    return
  }
  notify(t.reader.trashed, 'success')
  await refreshLists()
  // Continue with the next mail, like other mail programs.
  const next = mailStore.get().messages[index] ?? mailStore.get().messages[index - 1]
  if (next) void openMessage(next.id)
  else mailStore.set((state) => ({ ...state, selectedId: null, detail: null }))
}

export async function syncNow(): Promise<void> {
  await window.relay.mail.sync()
}

export function listenToMain(): () => void {
  const offChanged = window.relay.events.onChanged(() => void refreshLists())
  const offSync = window.relay.events.onSyncState((sync) => mailStore.set((state) => ({ ...state, sync })))
  void window.relay.mail.syncState().then((sync) => mailStore.set((state) => ({ ...state, sync })))
  return () => {
    offChanged()
    offSync()
  }
}

export function totalUnread(state: MailState): number {
  return Object.values(state.folders)
    .flat()
    .filter((folder) => folder.specialUse === 'inbox')
    .reduce((sum, folder) => sum + folder.unread, 0)
}
