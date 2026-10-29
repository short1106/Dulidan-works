import { EventEmitter } from 'node:events'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { AccountStore, type AccountInput, type AccountSettings, type SecretBox } from './accounts'
import { MailCache } from './cache'
import { CalendarStore } from './calendar/store'
import { DraftStore } from './drafts'
import { classifyError, MailError, type MailErrorCode } from './errors'
import { ImapSession, LARGE_MAIL_PLACEHOLDER, type ServerLogin } from './imap'
import { extractAttachment, extractInlineImages, parseMail, type AttachmentContent } from './parse'
import { DailyLimitReachedError, SentLog, type ReplyEvent } from './sentLog'
import { buildMessage, MAX_RECIPIENTS_WITHOUT_CONFIRMATION, recipientCount, sendRaw, TooManyRecipientsError, verifySmtp, type OutgoingMail } from './smtp'
import { openDatabase, type Database } from './sqlite'
import type { FolderInfo, MessageDetail, MessageSummary } from './types'

export interface MailServiceOptions {
  /** Folder for accounts.json and the local database. */
  dataDir: string
  secrets: SecretBox
  /** Only for local test servers with self-made certificates. Never for real accounts. */
  allowInsecureTls?: boolean
  /** Mails kept per folder in the local copy. */
  keepPerFolder?: number
}

export interface NewMailEvent {
  accountId: string
  folder: string
  messages: MessageSummary[]
}

export interface ConnectionTest {
  imap: MailErrorCode | null
  smtp: MailErrorCode | null
}

export interface SendOptions {
  /** Needed when sending to more than ten recipients at once. */
  confirmManyRecipients?: boolean
  /** Label stored with the sent mail, e.g. a Radar campaign. */
  tag?: string | null
}

type Events = {
  newMail: [NewMailEvent]
  reply: [ReplyEvent]
  syncError: [{ accountId: string; code: MailErrorCode }]
  changed: [{ accountId: string }]
}

/**
 * Everything about mail and calendar, without any user interface.
 * Relay shows it; Radar will use the same service for its mails.
 *
 * Safety rules built in here, so no app can forget them:
 *   - passwords are only stored encrypted (SecretBox),
 *   - "delete" only moves mails to the provider's trash, never deletes for good,
 *   - more than ten recipients need an explicit confirmation,
 *   - an account's daily send limit is never exceeded.
 */
export class MailService extends EventEmitter<Events> {
  readonly accounts: AccountStore
  readonly cache: MailCache
  readonly calendar: CalendarStore
  readonly sentLog: SentLog
  readonly drafts: DraftStore
  private readonly syncing = new Set<string>()
  private readonly sources = new Map<number, Buffer>()

  private constructor(
    private readonly db: Database,
    private readonly options: MailServiceOptions
  ) {
    super()
    this.accounts = new AccountStore(join(options.dataDir, 'accounts.json'), options.secrets)
    this.cache = new MailCache(db)
    this.calendar = new CalendarStore(db)
    this.sentLog = new SentLog(db)
    this.drafts = new DraftStore(db)
  }

  static async open(options: MailServiceOptions): Promise<MailService> {
    await mkdir(options.dataDir, { recursive: true })
    const service = new MailService(openDatabase(join(options.dataDir, 'relay.sqlite')), options)
    await service.accounts.load()
    return service
  }

  close(): void {
    this.db.close()
  }

  // ---------- Accounts ----------

  private login(account: Pick<AccountSettings, 'username'>, server: AccountSettings['imap'], password: string): ServerLogin {
    return { ...server, user: account.username, pass: password, allowInsecureTls: this.options.allowInsecureTls }
  }

  /** Tries to log in to both servers with the given settings. */
  async testConnection(input: AccountInput, password: string): Promise<ConnectionTest> {
    const result: ConnectionTest = { imap: null, smtp: null }
    await Promise.all([
      ImapSession.open(this.login(input, input.imap, password))
        .then((session) => session.close())
        .catch((error: unknown) => {
          result.imap = classifyError(error)
        }),
      verifySmtp(this.login(input, input.smtp, password)).catch((error: unknown) => {
        result.smtp = classifyError(error)
      })
    ])
    return result
  }

  addAccount(input: AccountInput, password: string): Promise<AccountSettings> {
    return this.accounts.add(input, password)
  }

  updateAccount(id: string, patch: Partial<AccountInput>, password?: string): Promise<AccountSettings> {
    return this.accounts.update(id, patch, password)
  }

  async removeAccount(id: string): Promise<void> {
    await this.accounts.remove(id)
    this.cache.removeAccount(id)
    this.drafts.removeAccount(id)
  }

  private account(id: string): AccountSettings {
    const account = this.accounts.get(id)
    if (!account) throw new MailError('not-found', 'Unknown account')
    return account
  }

  private async withImap<T>(accountId: string, work: (session: ImapSession) => Promise<T>): Promise<T> {
    const account = this.account(accountId)
    const session = await ImapSession.open(this.login(account, account.imap, this.accounts.password(accountId)))
    try {
      return await work(session)
    } finally {
      await session.close()
    }
  }

  // ---------- Fetching ----------

  /** Fetches all accounts. Errors of one account do not stop the others. */
  async syncAll(): Promise<void> {
    await Promise.all(this.accounts.list().map((account) => this.syncAccount(account.id).catch(() => undefined)))
  }

  /**
   * Fetches folders and new mails. Inbox, sent, drafts and trash are always
   * fetched; `extraFolders` adds others (e.g. the folder on screen).
   */
  async syncAccount(accountId: string, extraFolders: string[] = []): Promise<void> {
    if (this.syncing.has(accountId)) return
    this.syncing.add(accountId)
    try {
      await this.withImap(accountId, async (session) => {
        const folders = await session.folders()
        this.cache.setFolders(accountId, folders)
        const wanted = new Set(
          [
            ...folders.filter((folder) => ['inbox', 'sent', 'drafts', 'trash'].includes(folder.specialUse ?? '')).map((folder) => folder.path),
            ...extraFolders
          ].filter((path) => folders.some((folder) => folder.path === path))
        )
        for (const path of wanted) await this.syncFolder(session, accountId, path, folders.find((folder) => folder.path === path)?.specialUse ?? null)
      })
      this.emit('changed', { accountId })
    } catch (error) {
      const code = classifyError(error)
      this.emit('syncError', { accountId, code })
      throw new MailError(code, error instanceof Error ? error.message : String(error))
    } finally {
      this.syncing.delete(accountId)
    }
  }

  private async syncFolder(session: ImapSession, accountId: string, path: string, specialUse: string | null): Promise<void> {
    const state = this.cache.syncState(accountId, path)
    const firstTime = state.lastUid === 0
    const result = await session.sync(path, state, { initialLimit: this.options.keepPerFolder ?? 200 })
    this.cache.setSyncState(accountId, path, { uidValidity: result.uidValidity, lastUid: result.lastUid })

    // Mails gone from the server (moved or deleted elsewhere) leave the cache too.
    const gone = this.cache.uidsIn(accountId, path).filter((uid) => !result.seenByUid.has(uid))
    this.cache.removeUids(accountId, path, gone)
    const added = this.cache.upsertMessages(accountId, path, result.mails)
    // Read state changed in another mail program.
    for (const summary of this.cache.list(accountId, path, 1000)) {
      const seen = result.seenByUid.get(summary.uid)
      if (seen !== undefined && seen !== summary.seen) this.cache.setSeen(summary.id, seen)
    }
    this.cache.prune(accountId, path, this.options.keepPerFolder ?? 200)

    if (specialUse === 'sent' || added.length === 0) return
    const summaries = added.map((id) => this.cache.get(id)).filter((mail): mail is MessageDetail => mail !== null)
    for (const mail of summaries) {
      const reply = this.sentLog.detectReply(mail)
      if (reply) this.emit('reply', reply)
    }
    // No notification for the very first fetch of a folder (that is the old mail).
    if (specialUse === 'inbox' && !firstTime) {
      const unread = summaries.filter((mail) => !mail.seen)
      if (unread.length > 0) this.emit('newMail', { accountId, folder: path, messages: unread })
    }
  }

  // ---------- Reading ----------

  folders(accountId: string): FolderInfo[] {
    return this.cache.folders(accountId)
  }

  messages(accountId: string, folder: string, limit = 200): MessageSummary[] {
    return this.cache.list(accountId, folder, limit)
  }

  search(query: string, accountId?: string): MessageSummary[] {
    return this.cache.search(query, { accountId })
  }

  private async source(id: number): Promise<{ mail: MessageDetail; source: Buffer }> {
    const mail = this.cache.get(id)
    if (!mail) throw new MailError('not-found', 'Mail not found')
    let source = this.sources.get(id)
    if (!source) {
      source = (await this.withImap(mail.accountId, (session) => session.source(mail.folder, mail.uid))) ?? undefined
      if (!source) throw new MailError('not-found', 'Mail not found on the server')
      // Keep a few recently opened mails, for attachments and images.
      this.sources.set(id, source)
      if (this.sources.size > 8) this.sources.delete(this.sources.keys().next().value!)
    }
    return { mail, source }
  }

  /** A mail with text, HTML and attachment list. Big mails are fetched now. */
  async message(id: number): Promise<MessageDetail> {
    const mail = this.cache.get(id)
    if (!mail) throw new MailError('not-found', 'Mail not found')
    if (mail.text !== LARGE_MAIL_PLACEHOLDER) return mail
    const { source } = await this.source(id)
    const parsed = await parseMail(source, mail.uid, mail.seen)
    return { ...mail, text: parsed.text, html: parsed.html, attachments: parsed.attachments, replyTo: parsed.replyTo }
  }

  /** Marks a mail as read or unread, on the server and locally. */
  async setSeen(id: number, seen: boolean): Promise<void> {
    const mail = this.cache.get(id)
    if (!mail || mail.seen === seen) return
    this.cache.setSeen(id, seen)
    try {
      await this.withImap(mail.accountId, (session) => session.setSeen(mail.folder, mail.uid, seen))
    } catch (error) {
      this.cache.setSeen(id, !seen)
      throw error
    }
  }

  /**
   * "Löschen": moves the mail to the provider's trash. Version 1 never
   * deletes for good, so a mail already in the trash stays there.
   */
  async moveToTrash(id: number): Promise<void> {
    const mail = this.cache.get(id)
    if (!mail) throw new MailError('not-found', 'Mail not found')
    const trash = this.cache.findFolder(mail.accountId, 'trash')
    if (!trash) throw new MailError('no-trash-folder', 'The account has no trash folder')
    if (mail.folder === trash) throw new MailError('already-in-trash', 'Mails in the trash are not deleted for good in version 1')
    await this.withImap(mail.accountId, (session) => session.move(mail.folder, mail.uid, trash))
    this.cache.remove(id)
    this.sources.delete(id)
    this.emit('changed', { accountId: mail.accountId })
  }

  async attachment(id: number, index: number): Promise<AttachmentContent> {
    const { source } = await this.source(id)
    const attachment = await extractAttachment(source, index)
    if (!attachment) throw new MailError('not-found', 'Attachment not found')
    return attachment
  }

  /** Images embedded in the mail (cid:), as data URLs. No network access. */
  async inlineImages(id: number): Promise<Record<string, string>> {
    const { source } = await this.source(id)
    return extractInlineImages(source)
  }

  // ---------- Sending ----------

  /** Mails the account may still send today; null if it has no limit. */
  remainingToday(accountId: string, now = Date.now()): number | null {
    const limit = this.account(accountId).dailySendLimit
    if (limit === null) return null
    return Math.max(0, limit - this.sentLog.countToday(accountId, now))
  }

  async send(accountId: string, mail: Omit<OutgoingMail, 'from'>, options: SendOptions = {}): Promise<{ messageId: string }> {
    const account = this.account(accountId)
    const count = recipientCount(mail)
    if (count === 0) throw new MailError('unknown', 'No recipients')
    if (count > MAX_RECIPIENTS_WITHOUT_CONFIRMATION && !options.confirmManyRecipients) throw new TooManyRecipientsError(count)
    const remaining = this.remainingToday(accountId)
    if (remaining !== null && remaining < 1) throw new DailyLimitReachedError(account.dailySendLimit!, this.sentLog.countToday(accountId))

    const outgoing: OutgoingMail = { ...mail, from: { name: account.displayName, address: account.email } }
    const { raw, messageId } = await buildMessage(outgoing)
    await sendRaw(this.login(account, account.smtp, this.accounts.password(accountId)), outgoing, raw)
    this.sentLog.record({ messageId, accountId, to: [...mail.to, ...mail.cc, ...mail.bcc], subject: mail.subject, sentAt: Date.now(), tag: options.tag ?? null })

    // A copy in "Gesendet" (Gmail does this itself). A failure here does not undo the sending.
    const sent = this.cache.findFolder(accountId, 'sent')
    if (account.saveSentCopy && sent) {
      await this.withImap(accountId, (session) => session.append(sent, raw, ['\\Seen'])).catch(() => undefined)
    }
    return { messageId }
  }
}
