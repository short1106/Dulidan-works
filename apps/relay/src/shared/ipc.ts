/**
 * Messages between the Relay window and the main process.
 * Types come from mail-core (type-only imports, nothing is bundled twice).
 */
import type {
  AccountInput,
  AccountSettings,
  Address,
  AttachmentInfo,
  CalendarEvent,
  CalendarEventInput,
  ConnectionTest,
  Draft,
  DraftInput,
  FolderInfo,
  MailErrorCode,
  MessageDetail,
  MessageSummary,
  Occurrence,
  ProviderPreset
} from '@dulidan/mail-core'
import type { Settings } from '@dulidan/core'

export type {
  AccountInput,
  AccountSettings,
  Address,
  AttachmentInfo,
  CalendarEvent,
  CalendarEventInput,
  ConnectionTest,
  Draft,
  DraftInput,
  FolderInfo,
  MailErrorCode,
  MessageDetail,
  MessageSummary,
  Occurrence,
  ProviderPreset,
  Settings
}

/** Relay's own preferences, next to the shared settings. */
export interface RelayPrefs {
  /** Fetch new mail every n minutes. */
  pollMinutes: number
  notifications: boolean
}

export const POLL_CHOICES = [2, 5, 10, 15, 30] as const

export function normalizePrefs(raw: unknown): RelayPrefs {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const poll = Number(input['pollMinutes'])
  return {
    pollMinutes: (POLL_CHOICES as readonly number[]).includes(poll) ? poll : 5,
    notifications: input['notifications'] !== false
  }
}

/** Every call that can fail answers with ok/error instead of throwing across the bridge. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: MailErrorCode; message?: string }

export interface OutgoingAttachmentData {
  filename: string
  contentType: string
  content: Uint8Array
}

export interface SendRequest {
  accountId: string
  to: Address[]
  cc: Address[]
  bcc: Address[]
  subject: string
  html: string
  text: string
  attachments: OutgoingAttachmentData[]
  inReplyTo: string | null
  references: string[]
  confirmManyRecipients: boolean
  /** Local draft to remove after sending. */
  draftId: string | null
}

export interface CalendarOccurrence {
  event: CalendarEvent
  occurrence: Occurrence
}

export interface SyncState {
  syncing: boolean
  /** Accounts whose last fetch failed, with the reason. */
  errors: Record<string, MailErrorCode>
  lastSync: number | null
}

export interface AppInfo {
  version: string
  platform: string
  /** False if the system offers no secure key store; then no password can be saved. */
  secureStorage: boolean
}

export const IPC = {
  appInfo: 'app:info',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  prefsGet: 'prefs:get',
  prefsUpdate: 'prefs:update',

  accountsList: 'accounts:list',
  accountsPresets: 'accounts:presets',
  accountsTest: 'accounts:test',
  accountsAdd: 'accounts:add',
  accountsUpdate: 'accounts:update',
  accountsRemove: 'accounts:remove',

  mailSync: 'mail:sync',
  mailSyncState: 'mail:sync-state',
  mailFolders: 'mail:folders',
  mailMessages: 'mail:messages',
  mailMessage: 'mail:message',
  mailSetSeen: 'mail:set-seen',
  mailTrash: 'mail:trash',
  mailSearch: 'mail:search',
  mailSaveAttachment: 'mail:save-attachment',
  mailPreviewAttachment: 'mail:preview-attachment',
  mailAttachmentData: 'mail:attachment-data',
  mailImportIcsAttachment: 'mail:import-ics-attachment',
  mailLoadRemoteImages: 'mail:load-remote-images',
  mailOpenLink: 'mail:open-link',
  mailSend: 'mail:send',
  mailRemaining: 'mail:remaining',

  draftsList: 'drafts:list',
  draftsSave: 'drafts:save',
  draftsRemove: 'drafts:remove',

  calendarRange: 'calendar:range',
  calendarAdd: 'calendar:add',
  calendarUpdate: 'calendar:update',
  calendarRemove: 'calendar:remove',
  calendarImportFile: 'calendar:import-file',

  onChanged: 'event:changed',
  onSyncState: 'event:sync-state',
  onOpenMessage: 'event:open-message',

  windowSetDirty: 'window:set-dirty',
  windowCloseRequested: 'window:close-requested',
  windowConfirmClose: 'window:confirm-close'
} as const

export interface IcsImportSummary {
  added: number
  updated: number
  simplified: string[]
}
