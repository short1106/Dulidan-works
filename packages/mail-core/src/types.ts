/** Shapes shared by mail-core and the apps built on it. */

export interface Address {
  name: string
  address: string
}

export type SpecialUse = 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk' | 'archive' | null

export interface FolderInfo {
  accountId: string
  path: string
  name: string
  specialUse: SpecialUse
  unread: number
  total: number
}

export interface AttachmentInfo {
  /** Position in the message, used to download it. */
  index: number
  filename: string
  contentType: string
  size: number
  /** Content-ID for inline images, without < >. */
  contentId: string | null
  inline: boolean
}

export interface MessageSummary {
  /** Local id in the cache. */
  id: number
  accountId: string
  folder: string
  uid: number
  messageId: string | null
  inReplyTo: string | null
  references: string[]
  subject: string
  from: Address | null
  to: Address[]
  cc: Address[]
  /** Milliseconds since 1970 (UTC). */
  date: number
  seen: boolean
  hasAttachments: boolean
  snippet: string
}

export interface MessageDetail extends MessageSummary {
  text: string
  /** Raw HTML from the sender. Must be sanitized before showing it. */
  html: string | null
  attachments: AttachmentInfo[]
  replyTo: Address[]
}

/** A mail parsed from the server, before it is stored in the cache. */
export interface ParsedMail {
  uid: number
  messageId: string | null
  inReplyTo: string | null
  references: string[]
  subject: string
  from: Address | null
  to: Address[]
  cc: Address[]
  replyTo: Address[]
  date: number
  seen: boolean
  text: string
  html: string | null
  attachments: AttachmentInfo[]
  size: number
}
