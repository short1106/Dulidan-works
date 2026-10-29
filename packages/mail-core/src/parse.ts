import { simpleParser, type AddressObject, type Attachment } from 'mailparser'
import type { Address, AttachmentInfo, ParsedMail } from './types'

/** Turns the address headers of mailparser into a simple list. */
export function toAddresses(value: AddressObject | AddressObject[] | undefined): Address[] {
  const objects = Array.isArray(value) ? value : value ? [value] : []
  const result: Address[] = []
  for (const object of objects) {
    for (const entry of object.value) {
      if (entry.address) result.push({ name: entry.name ?? '', address: entry.address })
      // Groups: "Team: a@x, b@y;"
      for (const member of entry.group ?? []) if (member.address) result.push({ name: member.name ?? '', address: member.address })
    }
  }
  return result
}

function cleanId(value: string | undefined | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function describeAttachment(attachment: Attachment, index: number): AttachmentInfo {
  const contentId = attachment.contentId ? attachment.contentId.replace(/^<|>$/g, '') : null
  return {
    index,
    filename: attachment.filename || (attachment.contentType === 'text/calendar' ? 'termin.ics' : `Anhang-${index + 1}`),
    contentType: attachment.contentType || 'application/octet-stream',
    size: attachment.size ?? attachment.content?.length ?? 0,
    contentId,
    inline: attachment.contentDisposition === 'inline' && !!contentId && attachment.related === true
  }
}

/** Parses the full source of a mail. */
export async function parseMail(source: Buffer, uid: number, seen: boolean): Promise<ParsedMail> {
  const parsed = await simpleParser(source, { skipTextLinks: true })
  const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : []
  return {
    uid,
    messageId: cleanId(parsed.messageId),
    inReplyTo: cleanId(parsed.inReplyTo),
    references: references.map((ref) => ref.trim()).filter(Boolean),
    subject: parsed.subject ?? '',
    from: toAddresses(parsed.from)[0] ?? null,
    to: toAddresses(parsed.to),
    cc: toAddresses(parsed.cc),
    replyTo: toAddresses(parsed.replyTo),
    date: parsed.date?.getTime() ?? Date.now(),
    seen,
    text: (parsed.text ?? '').trim(),
    html: typeof parsed.html === 'string' ? parsed.html : null,
    attachments: parsed.attachments.map(describeAttachment),
    size: source.length
  }
}

export interface AttachmentContent {
  filename: string
  contentType: string
  content: Buffer
}

/** Gets one attachment (by its index) out of the full source. */
export async function extractAttachment(source: Buffer, index: number): Promise<AttachmentContent | null> {
  const parsed = await simpleParser(source)
  const attachment = parsed.attachments[index]
  if (!attachment) return null
  const info = describeAttachment(attachment, index)
  return { filename: info.filename, contentType: info.contentType, content: attachment.content }
}

/** Inline images (cid:...) as data URLs, so they can be shown without any network access. */
export async function extractInlineImages(source: Buffer, maxBytes = 5 * 1024 * 1024): Promise<Record<string, string>> {
  const parsed = await simpleParser(source)
  const images: Record<string, string> = {}
  let total = 0
  for (const attachment of parsed.attachments) {
    const contentId = attachment.contentId?.replace(/^<|>$/g, '')
    if (!contentId || !attachment.contentType.startsWith('image/')) continue
    total += attachment.content.length
    if (total > maxBytes) break
    images[contentId] = `data:${attachment.contentType};base64,${attachment.content.toString('base64')}`
  }
  return images
}
