import { findOriginalId, ImapSession, normalizeMessageId, parseMail, type ParsedMail, type ServerLogin } from '@dulidan/mail-core'
import type { Lead, RadarStore } from './leads'

/**
 * Finds answers to Radar mails in the inbox:
 *   - a reply points to our mail (In-Reply-To / References) or comes from the
 *     company's address after we wrote to it -> status "antwort"
 *   - a bounce ("Mail nicht zustellbar") from the mail server names our mail
 *     or the address -> status "unzustellbar"
 * Only companies with the status "kontaktiert" are changed, so a status the
 * user set by hand is never overwritten.
 */

export interface ReplyMatch {
  leadId: string
  kind: 'antwort' | 'unzustellbar'
  date: number
  subject: string
}

export interface ReplyCheckResult {
  replies: number
  bounces: number
  checked: number
}

const BOUNCE_SENDER = /mailer-daemon|postmaster|mail delivery|maildelivery|mailerdaemon/i

export function isBounce(mail: Pick<ParsedMail, 'from' | 'subject'>): boolean {
  const from = `${mail.from?.name ?? ''} ${mail.from?.address ?? ''}`
  return BOUNCE_SENDER.test(from) || /^(undeliver|unzustellbar|delivery status notification|returned mail|mail delivery failed)/i.test(mail.subject.trim())
}

/**
 * Which incoming mails belong to which company. `bodies` holds the text of
 * bounce mails (fetched separately, because only they need it).
 */
export function matchReplies(leads: Lead[], mails: ParsedMail[], bodies: Map<number, string> = new Map()): ReplyMatch[] {
  const contacted = leads.filter((lead) => lead.status === 'kontaktiert')
  const byMessageId = new Map(contacted.filter((lead) => lead.messageId).map((lead) => [normalizeMessageId(lead.messageId)!, lead]))
  const matches = new Map<string, ReplyMatch>()

  for (const mail of mails) {
    let lead: Lead | undefined
    let kind: ReplyMatch['kind'] = 'antwort'
    if (isBounce(mail)) {
      const text = (bodies.get(mail.uid) ?? '').toLowerCase()
      lead = contacted.find(
        (item) => (item.messageId && text.includes(normalizeMessageId(item.messageId)!)) || (item.email && text.includes(item.email.toLowerCase()))
      )
      kind = 'unzustellbar'
    } else {
      const original = findOriginalId(mail, (id) => byMessageId.has(id))
      lead = original ? byMessageId.get(original) : undefined
      // Many people answer with a new mail instead of "Antworten": same address, after our mail.
      lead ??= contacted.find(
        (item) => item.email && mail.from?.address.toLowerCase() === item.email.toLowerCase() && mail.date >= (item.contactedAt ?? item.createdAt)
      )
    }
    if (!lead) continue
    const known = matches.get(lead.id)
    // A real reply counts more than a bounce for the same company.
    if (!known || (known.kind === 'unzustellbar' && kind === 'antwort')) matches.set(lead.id, { leadId: lead.id, kind, date: mail.date, subject: mail.subject })
  }
  return [...matches.values()]
}

const DAY_MS = 24 * 60 * 60 * 1000

/** From when the inbox must be searched: the oldest open contact, at most 90 days back. */
export function searchSince(leads: Lead[], now = Date.now()): Date | null {
  // Companies mailed before Radar stored the date fall back to the day they were added.
  const times = leads.filter((lead) => lead.status === 'kontaktiert').map((lead) => lead.contactedAt ?? lead.createdAt)
  if (times.length === 0) return null
  return new Date(Math.max(Math.min(...times) - DAY_MS, now - 90 * DAY_MS))
}

/** Looks into the inbox once and updates the companies. */
export async function checkReplies(login: ServerLogin, store: RadarStore): Promise<ReplyCheckResult> {
  const since = searchSince(store.leads())
  if (!since) return { replies: 0, bounces: 0, checked: 0 }
  const session = await ImapSession.open(login)
  let mails: ParsedMail[]
  const bodies = new Map<number, string>()
  try {
    mails = await session.headersSince('INBOX', since)
    for (const mail of mails.filter(isBounce)) {
      const source = await session.source('INBOX', mail.uid)
      if (source) bodies.set(mail.uid, `${source.toString('utf8')}\n${(await parseMail(source, mail.uid, true)).text}`)
    }
  } finally {
    await session.close()
  }
  const matches = matchReplies(store.leads(), mails, bodies)
  for (const match of matches) {
    await store.updateLead(match.leadId, { status: match.kind, replyAt: match.date, replySubject: match.subject })
  }
  return {
    replies: matches.filter((match) => match.kind === 'antwort').length,
    bounces: matches.filter((match) => match.kind === 'unzustellbar').length,
    checked: mails.length
  }
}
