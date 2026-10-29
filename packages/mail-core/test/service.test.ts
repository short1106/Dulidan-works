import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { ImapFlow } from 'imapflow'
import MailComposer from 'nodemailer/lib/mail-composer'
import { SMTPServer } from 'smtp-server'
import { accountFromPreset, type AccountSettings } from '../src/accounts'
import { MailError } from '../src/errors'
import type { ReplyEvent } from '../src/sentLog'
import { MailService, type NewMailEvent } from '../src/service'
import { TooManyRecipientsError } from '../src/smtp'
import { fakeSecrets, tempDir } from './helpers'

/**
 * End-to-end test against LOCAL test servers only (never a real mailbox):
 * hoodiecrow-imap as IMAP server and smtp-server as SMTP server.
 */
const require = createRequire(import.meta.url)
const hoodiecrow = require('hoodiecrow-imap') as (options: unknown) => { listen: (port: number, cb: () => void) => void; close: (cb?: () => void) => void }

const IMAP_PORT = 21000 + Math.floor(Math.random() * 1000)
const SMTP_PORT = IMAP_PORT + 1000
const USER = 'tester@example.com'
const PASSWORD = 'test-passwort'

function rawMail(options: Record<string, unknown>): Promise<Buffer> {
  return new Promise((resolve, reject) => new MailComposer(options).compile().build((error, message) => (error ? reject(error) : resolve(message))))
}

let imap: ReturnType<typeof hoodiecrow>
let smtp: SMTPServer
const received: Array<{ from: string; to: string[]; raw: string }> = []
let service: MailService
let account: AccountSettings
let cleanup: () => Promise<void>
const newMail: NewMailEvent[] = []
const replies: ReplyEvent[] = []

/** Delivers a mail into the test mailbox, like a stranger sending it. */
async function deliver(raw: Buffer, folder = 'INBOX'): Promise<void> {
  const client = new ImapFlow({ host: '127.0.0.1', port: IMAP_PORT, secure: false, doSTARTTLS: false, auth: { user: USER, pass: PASSWORD }, logger: false })
  await client.connect()
  await client.append(folder, raw, [])
  await client.logout()
}

async function serverFlags(folder: string): Promise<string[][]> {
  const client = new ImapFlow({ host: '127.0.0.1', port: IMAP_PORT, secure: false, doSTARTTLS: false, auth: { user: USER, pass: PASSWORD }, logger: false })
  await client.connect()
  const lock = await client.getMailboxLock(folder)
  const flags: string[][] = []
  try {
    const status = client.mailbox
    if (status && status.exists > 0) for await (const message of client.fetch('1:*', { flags: true })) flags.push([...(message.flags ?? [])])
  } finally {
    lock.release()
    await client.logout()
  }
  return flags
}

beforeAll(async () => {
  const first = await rawMail({
    from: 'Anna Beispiel <anna@example.com>',
    to: USER,
    subject: 'Willkommen',
    text: 'Hallo, das ist die erste Mail.',
    html: '<p>Hallo, das ist die <b>erste</b> Mail.</p><img src="cid:logo@test"><img src="https://tracker.example.com/pixel.gif">',
    messageId: '<first@example.com>',
    attachments: [
      { filename: 'angebot.txt', content: 'Inhalt des Angebots', contentType: 'text/plain' },
      { filename: 'logo.png', cid: 'logo@test', content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'), contentType: 'image/png' }
    ]
  })
  imap = hoodiecrow({
    plugins: ['ID', 'SASL-IR', 'AUTH-PLAIN', 'NAMESPACE', 'IDLE', 'ENABLE', 'LITERALPLUS', 'UNSELECT', 'SPECIAL-USE', 'MOVE', 'UIDPLUS'],
    users: { [USER]: { password: PASSWORD } },
    storage: {
      INBOX: { messages: [{ raw: first.toString('binary'), flags: [] }] },
      '': {
        separator: '/',
        folders: {
          Gesendet: { 'special-use': '\\Sent', messages: [] },
          Entwuerfe: { 'special-use': '\\Drafts', messages: [] },
          Papierkorb: { 'special-use': '\\Trash', messages: [] }
        }
      }
    }
  })
  await new Promise<void>((resolve) => imap.listen(IMAP_PORT, resolve))

  smtp = new SMTPServer({
    disabledCommands: ['STARTTLS'],
    allowInsecureAuth: true,
    onAuth: (auth, _session, callback) =>
      auth.username === USER && auth.password === PASSWORD ? callback(null, { user: USER }) : callback(new Error('Invalid credentials')),
    onData: (stream, session, callback) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => {
        received.push({ from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '', to: session.envelope.rcptTo.map((r) => r.address), raw: Buffer.concat(chunks).toString() })
        callback()
      })
    }
  })
  await new Promise<void>((resolve) => smtp.listen(SMTP_PORT, '127.0.0.1', resolve))

  const temp = await tempDir()
  cleanup = temp.cleanup
  service = await MailService.open({ dataDir: temp.dir, secrets: fakeSecrets, allowInsecureTls: true })
  service.on('newMail', (event) => newMail.push(event))
  service.on('reply', (event) => replies.push(event))
}, 30_000)

afterAll(async () => {
  service?.close()
  await new Promise<void>((resolve) => smtp.close(() => resolve()))
  imap.close()
  await cleanup?.()
})

const settings = () => ({
  ...accountFromPreset('custom', USER, 'Test Betrieb'),
  imap: { host: '127.0.0.1', port: IMAP_PORT, secure: false },
  smtp: { host: '127.0.0.1', port: SMTP_PORT, secure: false }
})

describe('MailService with local test servers', () => {
  it('tests the login before an account is added', async () => {
    expect(await service.testConnection(settings(), PASSWORD)).toEqual({ imap: null, smtp: null })
    const wrong = await service.testConnection(settings(), 'falsch')
    expect(wrong.imap).toBe('auth-failed')
    expect(wrong.smtp).toBe('auth-failed')
    account = await service.addAccount(settings(), PASSWORD)
  })

  it('fetches folders and the existing mail without a "new mail" notice', async () => {
    await service.syncAccount(account.id)
    const folders = service.folders(account.id)
    expect(folders.map((f) => [f.path, f.specialUse])).toEqual([
      ['INBOX', 'inbox'],
      ['Entwuerfe', 'drafts'],
      ['Gesendet', 'sent'],
      ['Papierkorb', 'trash']
    ])
    const inbox = service.messages(account.id, 'INBOX')
    expect(inbox.map((m) => m.subject)).toEqual(['Willkommen'])
    expect(inbox[0]).toMatchObject({ seen: false, hasAttachments: true, from: { address: 'anna@example.com' } })
    expect(newMail).toHaveLength(0)
  })

  it('reads text, HTML, attachments and embedded images', async () => {
    const [first] = service.messages(account.id, 'INBOX')
    const detail = await service.message(first!.id)
    expect(detail.text).toContain('erste Mail')
    // mailparser already embeds cid images as data URLs.
    expect(detail.html).toContain('data:image/png;base64')
    expect(detail.html).toContain('https://tracker.example.com/pixel.gif')
    expect(detail.attachments.map((a) => [a.filename, a.inline]).sort()).toEqual([
      ['angebot.txt', false],
      ['logo.png', true]
    ])
    const offer = detail.attachments.find((a) => a.filename === 'angebot.txt')!
    const attachment = await service.attachment(first!.id, offer.index)
    expect(attachment.content.toString()).toBe('Inhalt des Angebots')
    const images = await service.inlineImages(first!.id)
    expect(images['logo@test']).toMatch(/^data:image\/png;base64,/)
    expect(service.search('angebots')).toHaveLength(0) // attachment text is not indexed
    expect(service.search('erste')).toHaveLength(1)
  })

  it('marks mails as read on the server', async () => {
    const [first] = service.messages(account.id, 'INBOX')
    await service.setSeen(first!.id, true)
    expect((await serverFlags('INBOX'))[0]).toContain('\\Seen')
    expect(service.folders(account.id)[0]!.unread).toBe(0)
  })

  it('reports new mail after the first fetch', async () => {
    await deliver(await rawMail({ from: 'Bernd <bernd@example.com>', to: USER, subject: 'Frage zum Termin', text: 'Passt Dienstag?' }))
    await service.syncAccount(account.id)
    expect(newMail).toHaveLength(1)
    expect(newMail[0]!.messages.map((m) => m.subject)).toEqual(['Frage zum Termin'])
  })

  it('sends a mail, stores a copy in "Gesendet" and remembers it', async () => {
    const result = await service.send(account.id, {
      to: [{ name: 'Kunde', address: 'kunde@example.com' }],
      cc: [],
      bcc: [{ name: '', address: 'geheim@example.com' }],
      subject: 'Ihr Angebot',
      html: '<p>Guten Tag</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==">',
      text: 'Guten Tag',
      attachments: [{ filename: 'preise.txt', contentType: 'text/plain', content: Buffer.from('Preisliste') }]
    })
    expect(received).toHaveLength(1)
    expect(received[0]!.to.sort()).toEqual(['geheim@example.com', 'kunde@example.com'])
    expect(received[0]!.raw).toContain(result.messageId)
    // Bcc stays invisible for the other recipients, pasted images become attachments.
    expect(received[0]!.raw).not.toContain('geheim@example.com')
    expect(received[0]!.raw).toMatch(/src=3D"cid:|src="cid:/)
    expect(service.sentLog.get(result.messageId)?.subject).toBe('Ihr Angebot')

    await service.syncAccount(account.id)
    expect(service.messages(account.id, 'Gesendet').map((m) => m.subject)).toEqual(['Ihr Angebot'])
  })

  it('recognizes the reply to a sent mail', async () => {
    const [sent] = service.messages(account.id, 'Gesendet')
    await deliver(
      await rawMail({
        from: 'Kunde <kunde@example.com>',
        to: USER,
        subject: 'Re: Ihr Angebot',
        text: 'Klingt gut!',
        inReplyTo: sent!.messageId!,
        references: [sent!.messageId!]
      })
    )
    await service.syncAccount(account.id)
    expect(replies).toHaveLength(1)
    expect(replies[0]!.original.subject).toBe('Ihr Angebot')
    expect(replies[0]!.from?.address).toBe('kunde@example.com')
  })

  it('moves mails to the trash and never deletes them for good', async () => {
    const target = service.messages(account.id, 'INBOX').find((m) => m.subject === 'Frage zum Termin')!
    await service.moveToTrash(target.id)
    expect(service.messages(account.id, 'INBOX').some((m) => m.subject === 'Frage zum Termin')).toBe(false)
    await service.syncAccount(account.id)
    const inTrash = service.messages(account.id, 'Papierkorb')
    expect(inTrash.map((m) => m.subject)).toEqual(['Frage zum Termin'])
    await expect(service.moveToTrash(inTrash[0]!.id)).rejects.toMatchObject({ code: 'already-in-trash' })
    expect(await serverFlags('Papierkorb')).toHaveLength(1)
  })

  it('asks before more than ten recipients and keeps the daily limit', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ name: '', address: `person${i}@example.com` }))
    const mail = { to: many, cc: [], bcc: [], subject: 'Rundmail', html: '<p>Hallo</p>', text: 'Hallo', attachments: [] }
    await expect(service.send(account.id, mail)).rejects.toBeInstanceOf(TooManyRecipientsError)
    expect(received).toHaveLength(1)

    await service.updateAccount(account.id, { dailySendLimit: 2 })
    expect(service.remainingToday(account.id)).toBe(1)
    await service.send(account.id, { ...mail, to: many.slice(0, 1) })
    await expect(service.send(account.id, { ...mail, to: many.slice(0, 1) })).rejects.toMatchObject({ name: 'DailyLimitReachedError' })
    expect(received).toHaveLength(2)
  })

  it('reports a wrong password as an error code', async () => {
    await service.updateAccount(account.id, {}, 'falsch')
    await expect(service.syncAccount(account.id)).rejects.toBeInstanceOf(MailError)
    await expect(service.syncAccount(account.id)).rejects.toMatchObject({ code: 'auth-failed' })
  })
})
