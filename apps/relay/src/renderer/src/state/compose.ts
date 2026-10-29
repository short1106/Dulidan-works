import { useSyncExternalStore } from 'react'
import { ask, notify } from '@dulidan/design-system'
import { createStore } from '@dulidan/core'
import type { Draft, MessageDetail, OutgoingAttachmentData } from '../../../shared/ipc'
import { can } from '../features'
import { t } from '../i18n'
import { formatAddressList, parseAddressList } from '../mail/addresses'
import { prefixSubject, quoteOriginal, replyRecipients, replyReferences, signatureToHtml, type ComposeKind } from '../mail/quote'
import { sanitizeMailHtml } from '../mail/sanitize'
import { errorText, refreshLists } from './mail'
import { accountsStore, currentMode } from './settings'

/** Biggest total size of attachments; many providers refuse bigger mails. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
/** More recipients than this need a confirmation (same rule as in mail-core). */
const MANY_RECIPIENTS = 10

export interface ComposeState {
  open: boolean
  kind: ComposeKind
  accountId: string
  to: string
  cc: string
  bcc: string
  showCc: boolean
  subject: string
  /** HTML the editor starts with. */
  initialHtml: string
  html: string
  text: string
  attachments: OutgoingAttachmentData[]
  inReplyTo: string | null
  references: string[]
  draftId: string | null
  dirty: boolean
  sending: boolean
  /** Changes when a new mail is opened, so the editor starts fresh. */
  editorKey: number
}

const closed: ComposeState = {
  open: false,
  kind: 'new',
  accountId: '',
  to: '',
  cc: '',
  bcc: '',
  showCc: false,
  subject: '',
  initialHtml: '',
  html: '',
  text: '',
  attachments: [],
  inReplyTo: null,
  references: [],
  draftId: null,
  dirty: false,
  sending: false,
  editorKey: 0
}

export const composeStore = createStore<ComposeState>(closed)
export const useCompose = (): ComposeState => useSyncExternalStore(composeStore.subscribe, composeStore.get)

// The close button of the window asks first while a mail is being written.
composeStore.subscribe(() => window.relay.window.setDirty(composeStore.get().open && composeStore.get().dirty))

export function updateCompose(patch: Partial<ComposeState>): void {
  composeStore.set((state) => ({ ...state, ...patch, dirty: true }))
}

function signatureFor(accountId: string): string {
  const signature = accountsStore.get().find((account) => account.id === accountId)?.signature ?? ''
  return signatureToHtml(signature)
}

/** Opens the composer: new mail, reply, reply to all or forward. */
export async function openCompose(kind: ComposeKind, mail?: MessageDetail, preset?: { to?: string }): Promise<void> {
  if (composeStore.get().open && !(await closeCompose())) return
  const accounts = accountsStore.get()
  const account = accounts.find((item) => item.id === mail?.accountId) ?? accounts[0]
  if (!account) {
    notify(t.compose.noAccount, 'info')
    return
  }
  const own = accounts.map((item) => item.email)
  const signature = signatureFor(account.id)
  const state: ComposeState = { ...closed, open: true, kind, accountId: account.id, editorKey: Date.now(), to: preset?.to ?? '' }

  if (mail && kind !== 'new') {
    // The quote never loads images from the internet.
    const safe = mail.html ? sanitizeMailHtml(mail.html, null).html : null
    const quote = quoteOriginal(mail, kind, { quoteHeader: t.compose.quoteHeader, forwardHeader: t.compose.forwardHeader }, safe)
    if (kind === 'forward') {
      state.subject = prefixSubject(mail.subject, t.compose.forwardPrefix)
      const attachments: OutgoingAttachmentData[] = []
      for (const item of mail.attachments.filter((entry) => !entry.inline)) {
        const data = await window.relay.mail.attachmentData(mail.id, item.index)
        if (data.ok) attachments.push(data.value)
      }
      state.attachments = attachments
    } else {
      const recipients = replyRecipients(mail, own, kind === 'replyAll')
      state.to = formatAddressList(recipients.to)
      state.cc = formatAddressList(recipients.cc)
      state.showCc = recipients.cc.length > 0
      state.subject = prefixSubject(mail.subject, t.compose.replyPrefix)
      state.inReplyTo = mail.messageId
      state.references = replyReferences(mail)
    }
    state.initialHtml = `<p></p>${signature}${quote}`
  } else {
    state.initialHtml = `<p></p>${signature}`
  }
  state.html = state.initialHtml
  composeStore.set(state)
}

export function openDraft(draft: Draft): void {
  composeStore.set({
    ...closed,
    open: true,
    kind: 'new',
    accountId: draft.accountId,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    showCc: !!(draft.cc || draft.bcc),
    subject: draft.subject,
    initialHtml: draft.html,
    html: draft.html,
    attachments: draft.attachments.map((item) => ({
      filename: item.filename,
      contentType: item.contentType,
      content: Uint8Array.from(atob(item.base64), (char) => char.charCodeAt(0))
    })),
    inReplyTo: draft.inReplyTo,
    references: draft.references,
    draftId: draft.id,
    editorKey: Date.now()
  })
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export async function saveDraft(): Promise<void> {
  const state = composeStore.get()
  const draft = await window.relay.drafts.save({
    id: state.draftId ?? undefined,
    accountId: state.accountId,
    to: state.to,
    cc: state.cc,
    bcc: state.bcc,
    subject: state.subject,
    html: state.html,
    attachments: state.attachments.map((item) => ({ filename: item.filename, contentType: item.contentType, base64: toBase64(item.content) })),
    inReplyTo: state.inReplyTo,
    references: state.references
  })
  composeStore.set((current) => ({ ...current, draftId: draft.id, dirty: false }))
  notify(t.compose.draftSaved, 'success')
  void refreshLists()
}

/** Closes the composer; asks first if something was written. Returns false if the user wants to keep writing. */
export async function closeCompose(): Promise<boolean> {
  const state = composeStore.get()
  if (!state.open) return true
  if (state.dirty) {
    const drafts = can('drafts', currentMode())
    const answer = await ask({
      title: t.compose.leaveTitle,
      text: drafts ? t.compose.leaveText : t.compose.leaveTextBasic,
      cancelValue: 'keep',
      choices: [
        { value: 'keep', label: t.compose.keepWriting, variant: 'ghost' },
        { value: 'discard', label: t.compose.discard, variant: 'secondary' },
        ...(drafts ? [{ value: 'save', label: t.compose.saveDraft, variant: 'primary' as const }] : [])
      ]
    })
    if (answer === 'keep') return false
    if (answer === 'save') await saveDraft()
  }
  composeStore.set({ ...closed })
  return true
}

/** Checks everything, asks where needed, then sends. */
export async function sendCompose(): Promise<void> {
  const state = composeStore.get()
  if (state.sending) return
  const to = parseAddressList(state.to)
  const cc = parseAddressList(state.cc)
  const bcc = parseAddressList(state.bcc)
  const invalid = [...to.invalid, ...cc.invalid, ...bcc.invalid]
  if (invalid.length > 0) {
    notify(t.compose.invalidAddresses(invalid.join(', ')), 'error')
    return
  }
  const recipients = new Set([...to.addresses, ...cc.addresses, ...bcc.addresses].map((entry) => entry.address.toLowerCase()))
  if (recipients.size === 0) {
    notify(t.compose.noRecipient, 'error')
    return
  }
  const size = state.attachments.reduce((sum, item) => sum + item.content.length, 0)
  if (size > MAX_ATTACHMENT_BYTES) {
    notify(t.compose.tooBig, 'error')
    return
  }
  if (!state.subject.trim()) {
    const answer = await ask({
      title: t.compose.noSubjectTitle,
      text: t.compose.noSubjectText,
      cancelValue: 'no',
      choices: [
        { value: 'no', label: t.dialogs.cancel, variant: 'ghost' },
        { value: 'yes', label: t.compose.sendAnyway, variant: 'primary' }
      ]
    })
    if (answer !== 'yes') return
  }
  let confirmMany = false
  if (recipients.size > MANY_RECIPIENTS) {
    const answer = await ask({
      title: t.compose.manyTitle,
      text: t.compose.manyText(recipients.size),
      cancelValue: 'no',
      choices: [
        { value: 'no', label: t.dialogs.cancel, variant: 'ghost' },
        { value: 'yes', label: t.compose.manyConfirm(recipients.size), variant: 'primary' }
      ]
    })
    if (answer !== 'yes') return
    confirmMany = true
  }

  composeStore.set((current) => ({ ...current, sending: true }))
  const result = await window.relay.mail.send({
    accountId: state.accountId,
    to: to.addresses,
    cc: cc.addresses,
    bcc: bcc.addresses,
    subject: state.subject.trim(),
    html: state.html,
    text: state.text,
    attachments: state.attachments,
    inReplyTo: state.inReplyTo,
    references: state.references,
    confirmManyRecipients: confirmMany,
    draftId: state.draftId
  })
  if (!result.ok) {
    composeStore.set((current) => ({ ...current, sending: false }))
    notify(errorText(result.error), 'error')
    return
  }
  composeStore.set({ ...closed })
  notify(t.compose.sent, 'success')
  void refreshLists()
}
