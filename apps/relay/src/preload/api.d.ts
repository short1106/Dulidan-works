import type {
  AccountInput,
  AccountSettings,
  AppInfo,
  CalendarEvent,
  CalendarEventInput,
  CalendarOccurrence,
  ConnectionTest,
  Draft,
  DraftInput,
  FolderInfo,
  IcsImportSummary,
  MessageDetail,
  MessageSummary,
  OutgoingAttachmentData,
  ProviderPreset,
  RelayPrefs,
  Result,
  SendRequest,
  Settings,
  SyncState
} from '../shared/ipc'

/** Everything the Relay window may ask the system for, as `window.relay`. */
export interface RelayApi {
  appInfo(): Promise<AppInfo>
  settings: { get(): Promise<Settings>; update(patch: Partial<Settings>): Promise<Settings> }
  prefs: { get(): Promise<RelayPrefs>; update(patch: Partial<RelayPrefs>): Promise<RelayPrefs> }

  accounts: {
    list(): Promise<AccountSettings[]>
    presets(): Promise<Record<string, ProviderPreset>>
    test(input: AccountInput, password: string): Promise<ConnectionTest>
    add(input: AccountInput, password: string): Promise<Result<AccountSettings>>
    update(id: string, patch: Partial<AccountInput>, password?: string): Promise<Result<AccountSettings>>
    remove(id: string): Promise<void>
  }

  mail: {
    /** Fetches now; without id all accounts. */
    sync(accountId?: string, folder?: string): Promise<void>
    syncState(): Promise<SyncState>
    folders(accountId: string): Promise<FolderInfo[]>
    messages(accountId: string, folder: string): Promise<MessageSummary[]>
    /** Inboxes of all accounts together, newest first. */
    allInboxes(): Promise<MessageSummary[]>
    message(id: number): Promise<Result<MessageDetail>>
    setSeen(id: number, seen: boolean): Promise<Result<void>>
    moveToTrash(id: number): Promise<Result<void>>
    search(query: string): Promise<MessageSummary[]>
    saveAttachment(id: number, index: number): Promise<Result<string | null>>
    /** Images only, as data URL. */
    previewAttachment(id: number, index: number): Promise<Result<string>>
    /** Content of an attachment, e.g. to forward it. */
    attachmentData(id: number, index: number): Promise<Result<OutgoingAttachmentData>>
    importIcsAttachment(id: number, index: number): Promise<Result<IcsImportSummary>>
    /** Loads the images of one mail from the internet, after the user asked for it. */
    loadRemoteImages(urls: string[]): Promise<Record<string, string>>
    /** Opens a web link in the normal browser (only after the user confirmed). */
    openLink(url: string): Promise<void>
    send(request: SendRequest): Promise<Result<{ messageId: string }>>
    remainingToday(accountId: string): Promise<number | null>
  }

  drafts: {
    list(): Promise<Draft[]>
    save(draft: DraftInput): Promise<Draft>
    remove(id: string): Promise<void>
  }

  calendar: {
    range(fromUtc: number, toUtc: number): Promise<CalendarOccurrence[]>
    add(input: CalendarEventInput): Promise<Result<CalendarEvent>>
    update(id: string, input: CalendarEventInput): Promise<Result<CalendarEvent>>
    remove(id: string): Promise<void>
    importFile(): Promise<Result<IcsImportSummary | null>>
  }

  events: {
    /** Mails or calendar changed (after a fetch, a move, ...). */
    onChanged(listener: () => void): () => void
    onSyncState(listener: (state: SyncState) => void): () => void
    /** A notification was clicked: show this mail. */
    onOpenMessage(listener: (id: number) => void): () => void
  }

  window: {
    setDirty(dirty: boolean): void
    onCloseRequested(listener: () => void): () => void
    confirmClose(): void
  }
}

declare global {
  interface Window {
    relay: RelayApi
  }
}
