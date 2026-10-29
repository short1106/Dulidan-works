import { ImapFlow, type ListResponse } from 'imapflow'
import type { FolderSyncState, FolderUpdate } from './cache'
import { parseMail } from './parse'
import type { ParsedMail, SpecialUse } from './types'

export interface ServerLogin {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  /** Only for local test servers with self-made certificates. */
  allowInsecureTls?: boolean
}

export interface SyncOptions {
  /** How many mails are fetched the first time a folder is opened. */
  initialLimit?: number
  /** Mails bigger than this are fetched later, when opened. */
  maxSourceBytes?: number
}

export interface SyncResult {
  uidValidity: string
  lastUid: number
  mails: ParsedMail[]
  /** Read state of every mail on the server, by uid. */
  seenByUid: Map<number, boolean>
}

const SPECIAL_USE: Record<string, SpecialUse> = {
  '\\Inbox': 'inbox',
  '\\Sent': 'sent',
  '\\Drafts': 'drafts',
  '\\Trash': 'trash',
  '\\Junk': 'junk',
  '\\Archive': 'archive'
}

/** Mails that are too big to fetch at once show this text until opened. */
export const LARGE_MAIL_PLACEHOLDER = '\u0000large'

function toFolder(entry: ListResponse): FolderUpdate {
  return { path: entry.path, name: entry.name, specialUse: (entry.specialUse && SPECIAL_USE[entry.specialUse]) || (entry.path.toUpperCase() === 'INBOX' ? 'inbox' : null) }
}

/**
 * One connection to an IMAP server. Opened for a job (sync, move, ...)
 * and closed again, so a broken connection never stays around.
 */
export class ImapSession {
  private constructor(private readonly client: ImapFlow) {}

  static async open(login: ServerLogin): Promise<ImapSession> {
    const client = new ImapFlow({
      host: login.host,
      port: login.port,
      secure: login.secure,
      auth: { user: login.user, pass: login.pass },
      logger: false,
      // Never fall back to an unencrypted connection on real servers.
      doSTARTTLS: login.secure ? undefined : !login.allowInsecureTls,
      tls: { rejectUnauthorized: !login.allowInsecureTls },
      connectionTimeout: 20_000,
      greetingTimeout: 15_000,
      socketTimeout: 120_000
    })
    // Errors after login are reported through the next command.
    client.on('error', () => undefined)
    await client.connect()
    return new ImapSession(client)
  }

  async close(): Promise<void> {
    await this.client.logout().catch(() => this.client.close())
  }

  async folders(): Promise<FolderUpdate[]> {
    const list = await this.client.list()
    return list.filter((entry) => !entry.flags.has('\\Noselect') && !entry.flags.has('\\NonExistent')).map(toFolder)
  }

  /** Fetches new mails of a folder and the read state of all mails. */
  async sync(path: string, state: FolderSyncState, options: SyncOptions = {}): Promise<SyncResult> {
    const initialLimit = options.initialLimit ?? 200
    const maxSourceBytes = options.maxSourceBytes ?? 5 * 1024 * 1024
    const lock = await this.client.getMailboxLock(path)
    try {
      const mailbox = this.client.mailbox
      if (!mailbox) throw new Error(`Folder ${path} could not be opened`)
      const uidValidity = String(mailbox.uidValidity)
      const fresh = state.uidValidity !== uidValidity
      const lastUid = fresh ? 0 : state.lastUid
      const result: SyncResult = { uidValidity, lastUid, mails: [], seenByUid: new Map() }
      if (mailbox.exists === 0) return result

      // Read state of all mails (small: only uid and flags).
      for await (const message of this.client.fetch('1:*', { uid: true, flags: true })) {
        result.seenByUid.set(message.uid, message.flags?.has('\\Seen') ?? false)
      }

      // Which mails are new?
      const uids = [...result.seenByUid.keys()].sort((a, b) => a - b)
      const wanted = lastUid === 0 ? uids.slice(-initialLimit) : uids.filter((uid) => uid > lastUid)
      if (wanted.length === 0) return result

      const small: number[] = []
      const large: number[] = []
      for await (const message of this.client.fetch(wanted.join(','), { uid: true, size: true }, { uid: true })) {
        ;(message.size !== undefined && message.size > maxSourceBytes ? large : small).push(message.uid)
      }
      if (small.length > 0) {
        for await (const message of this.client.fetch(small.join(','), { uid: true, source: true }, { uid: true })) {
          if (!message.source) continue
          result.mails.push(await parseMail(message.source, message.uid, result.seenByUid.get(message.uid) ?? false))
        }
      }
      if (large.length > 0) {
        for await (const message of this.client.fetch(large.join(','), { uid: true, headers: true, size: true }, { uid: true })) {
          if (!message.headers) continue
          const mail = await parseMail(message.headers, message.uid, result.seenByUid.get(message.uid) ?? false)
          result.mails.push({ ...mail, text: LARGE_MAIL_PLACEHOLDER, size: message.size ?? mail.size })
        }
      }
      result.lastUid = Math.max(lastUid, ...result.mails.map((mail) => mail.uid))
      return result
    } finally {
      lock.release()
    }
  }

  /** The complete raw mail, e.g. for attachments. */
  async source(path: string, uid: number): Promise<Buffer | null> {
    const lock = await this.client.getMailboxLock(path)
    try {
      const message = await this.client.fetchOne(String(uid), { source: true }, { uid: true })
      return message ? (message.source ?? null) : null
    } finally {
      lock.release()
    }
  }

  async setSeen(path: string, uid: number, seen: boolean): Promise<void> {
    const lock = await this.client.getMailboxLock(path)
    try {
      if (seen) await this.client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
      else await this.client.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true })
    } finally {
      lock.release()
    }
  }

  /** Moves a mail to another folder. Mails are never deleted for good. */
  async move(path: string, uid: number, target: string): Promise<void> {
    const lock = await this.client.getMailboxLock(path)
    try {
      const result = await this.client.messageMove(String(uid), target, { uid: true })
      if (!result) throw new Error('Move failed')
    } finally {
      lock.release()
    }
  }

  /** Stores a mail in a folder, e.g. a copy in "Gesendet". */
  async append(path: string, raw: Buffer, flags: string[]): Promise<void> {
    await this.client.append(path, raw, flags)
  }
}

/** Only checks that login works. */
export async function verifyImap(login: ServerLogin): Promise<void> {
  const session = await ImapSession.open(login)
  await session.close()
}
