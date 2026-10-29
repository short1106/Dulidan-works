import { randomUUID } from 'node:crypto'
import nodemailer, { type Transporter } from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer'
import type { ServerLogin } from './imap'
import type { Address } from './types'

export interface OutgoingAttachment {
  filename: string
  contentType: string
  content: Uint8Array
  /** Content-ID for images shown inside the text. */
  cid?: string
}

export interface OutgoingMail {
  from: Address
  to: Address[]
  cc: Address[]
  bcc: Address[]
  subject: string
  html: string
  text: string
  attachments: OutgoingAttachment[]
  inReplyTo?: string | null
  references?: string[]
}

/** More recipients than this need an explicit confirmation by the user. */
export const MAX_RECIPIENTS_WITHOUT_CONFIRMATION = 10

export class TooManyRecipientsError extends Error {
  constructor(readonly count: number) {
    super(`${count} recipients need a confirmation`)
    this.name = 'TooManyRecipientsError'
  }
}

export function recipientCount(mail: Pick<OutgoingMail, 'to' | 'cc' | 'bcc'>): number {
  return new Set([...mail.to, ...mail.cc, ...mail.bcc].map((entry) => entry.address.toLowerCase())).size
}

/**
 * Images pasted into the text arrive as data URLs. Mail programs show them
 * best as attachments with a Content-ID, so they are moved there.
 */
export function moveInlineImagesToAttachments(html: string): { html: string; attachments: OutgoingAttachment[] } {
  const attachments: OutgoingAttachment[] = []
  const output = html.replace(/src="data:(image\/[a-z0-9.+-]+);base64,([^"]+)"/gi, (_match, type: string, data: string) => {
    const cid = `${randomUUID()}@dulidan`
    const extension = type.split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') ?? 'img'
    attachments.push({ filename: `bild-${attachments.length + 1}.${extension}`, contentType: type, content: Buffer.from(data, 'base64'), cid })
    return `src="cid:${cid}"`
  })
  return { html: output, attachments }
}

function formatAddress(entry: Address): { name: string; address: string } {
  return { name: entry.name, address: entry.address }
}

/** Builds the complete raw mail. The same bytes are sent and stored in "Gesendet". */
export async function buildMessage(mail: OutgoingMail): Promise<{ raw: Buffer; messageId: string }> {
  const domain = mail.from.address.split('@')[1] ?? 'localhost'
  const messageId = `<${randomUUID()}@${domain}>`
  const { html, attachments: inline } = moveInlineImagesToAttachments(mail.html)
  const composer = new MailComposer({
    from: formatAddress(mail.from),
    to: mail.to.map(formatAddress),
    cc: mail.cc.map(formatAddress),
    bcc: mail.bcc.map(formatAddress),
    subject: mail.subject,
    html,
    text: mail.text,
    messageId,
    date: new Date(),
    inReplyTo: mail.inReplyTo ?? undefined,
    references: mail.references && mail.references.length > 0 ? mail.references : undefined,
    attachments: [...mail.attachments, ...inline].map((item) => ({
      filename: item.filename,
      contentType: item.contentType,
      content: Buffer.from(item.content),
      cid: item.cid
    }))
  })
  // MailComposer leaves the Bcc header out of the raw mail by default, so the
  // stored copy and the other recipients never see the Bcc addresses.
  const raw = await new Promise<Buffer>((resolve, reject) =>
    composer.compile().build((error, message) => (error ? reject(error) : resolve(message)))
  )
  return { raw, messageId }
}

function transport(login: ServerLogin): Transporter {
  return nodemailer.createTransport({
    host: login.host,
    port: login.port,
    secure: login.secure,
    requireTLS: !login.secure && !login.allowInsecureTls,
    auth: { user: login.user, pass: login.pass },
    tls: { rejectUnauthorized: !login.allowInsecureTls },
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 120_000
  })
}

/** Sends a built mail to all recipients (including Bcc). */
export async function sendRaw(login: ServerLogin, mail: OutgoingMail, raw: Buffer): Promise<void> {
  const recipients = [...mail.to, ...mail.cc, ...mail.bcc].map((entry) => entry.address)
  const sender = transport(login)
  try {
    await sender.sendMail({ envelope: { from: mail.from.address, to: recipients }, raw })
  } finally {
    sender.close()
  }
}

export async function verifySmtp(login: ServerLogin): Promise<void> {
  const sender = transport(login)
  try {
    await sender.verify()
  } finally {
    sender.close()
  }
}
