import { mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import MailComposer from 'nodemailer/lib/mail-composer'
import type { ParsedMail } from '@dulidan/mail-core'
import { RadarStore, type Lead } from '../src/main/leads'
import { addressLines, letterDate, lettersHtml, letterText, senderTown } from '../src/main/letters'
import { checkReplies, isBounce, matchReplies, searchSince } from '../src/main/replies'
import { templateById } from '../src/main/templates'

/**
 * Replies and letters. The inbox test runs against a LOCAL test server
 * (hoodiecrow-imap), never against a real mailbox.
 */

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 10, 12)

function lead(patch: Partial<Lead>): Lead {
  return {
    id: 'l1',
    name: 'Zimmerei Holz GmbH',
    branche: 'Zimmerei',
    address: 'Waldweg 3, 74613 Öhringen, Deutschland',
    phone: null,
    website: null,
    email: 'info@holz.example',
    checkedAt: null,
    status: 'kontaktiert',
    note: '',
    contactedAt: NOW - 2 * DAY,
    createdAt: NOW - 10 * DAY,
    messageId: '<abc123@dulidan.example>',
    ...patch
  }
}

function mail(patch: Partial<ParsedMail>): ParsedMail {
  return {
    uid: 1,
    messageId: '<reply@holz.example>',
    inReplyTo: null,
    references: [],
    subject: 'Re: Kurze Idee zu Ihrer Website',
    from: { name: 'Herr Holz', address: 'info@holz.example' },
    to: [],
    cc: [],
    replyTo: [],
    date: NOW - DAY,
    seen: false,
    text: '',
    html: null,
    attachments: [],
    size: 100,
    ...patch
  }
}

describe('recognizing replies', () => {
  it('finds a reply by In-Reply-To, even from another address', () => {
    const matches = matchReplies([lead({})], [mail({ inReplyTo: '<ABC123@dulidan.example>', from: { name: '', address: 'chef@holz.example' } })])
    expect(matches).toEqual([{ leadId: 'l1', kind: 'antwort', date: NOW - DAY, subject: 'Re: Kurze Idee zu Ihrer Website' }])
  })

  it('finds a new mail from the company address after our mail', () => {
    expect(matchReplies([lead({})], [mail({ subject: 'Anfrage' })])).toHaveLength(1)
    // Mails from before our contact are not replies.
    expect(matchReplies([lead({})], [mail({ date: NOW - 5 * DAY })])).toEqual([])
  })

  it('recognizes bounces by the Message-ID or the address in the text', () => {
    const bounce = mail({ uid: 7, from: { name: 'Mail Delivery System', address: 'MAILER-DAEMON@ionos.example' }, subject: 'Mail delivery failed' })
    expect(isBounce(bounce)).toBe(true)
    const matches = matchReplies([lead({})], [bounce], new Map([[7, 'Original-Message-ID: <abc123@dulidan.example>']]))
    expect(matches.map((match) => match.kind)).toEqual(['unzustellbar'])
    expect(matchReplies([lead({})], [bounce], new Map([[7, 'irgendwas anderes']]))).toEqual([])
  })

  it('never changes companies whose status was set by hand', () => {
    expect(matchReplies([lead({ status: 'kein_interesse' })], [mail({})])).toEqual([])
    expect(matchReplies([lead({ status: 'neu' })], [mail({})])).toEqual([])
  })

  it('searches from the oldest open contact, at most 90 days back', () => {
    expect(searchSince([lead({})], NOW)?.getTime()).toBe(NOW - 3 * DAY)
    expect(searchSince([lead({ contactedAt: NOW - 400 * DAY })], NOW)?.getTime()).toBe(NOW - 90 * DAY)
    // Mailed before Radar stored the date: the day the company was added counts.
    expect(searchSince([lead({ contactedAt: null })], NOW)?.getTime()).toBe(NOW - 11 * DAY)
    expect(searchSince([lead({ status: 'neu' })], NOW)).toBeNull()
  })
})

describe('letters', () => {
  it('splits addresses into lines and drops the country', () => {
    expect(addressLines('Waldweg 3, 74613 Öhringen, Deutschland')).toEqual(['Waldweg 3', '74613 Öhringen'])
    expect(senderTown('Hauptstraße 1\n74613 Öhringen')).toBe('Öhringen')
    expect(letterDate(new Date(NOW), 'Öhringen')).toBe('Öhringen, 10. November 2026')
  })

  it('uses the mail text, with a paper hint instead of "antworten Sie mit Abmelden"', () => {
    const { subject, body } = letterText(templateById('zimmerei'), { name: 'Zimmerei Holz GmbH' })
    expect(subject).toBe('Kurze Idee zu Ihrer Website')
    expect(body).toContain('Guten Tag,')
    expect(body).not.toContain('Abmelden')
    expect(body).toContain('keine weitere Post')
  })

  it('makes one page per company with sender, address field, date and subject', () => {
    const html = lettersHtml(
      [lead({}), lead({ id: 'l2', name: 'Holzbau <Müller> & Söhne', address: 'Am Bach 1, 74629 Pfedelbach' })],
      templateById('zimmerei_ohne_website'),
      { name: 'Shaquille El Moussaoui', address: 'Hauptstraße 1\n74613 Öhringen', email: 'info@dulidan-studios.com' },
      new Date(NOW)
    )
    expect(html.match(/<section class="letter">/g)).toHaveLength(2)
    expect(html).toContain('Shaquille El Moussaoui · Hauptstraße 1 · 74613 Öhringen')
    expect(html).toContain('<div>74629 Pfedelbach</div>')
    expect(html).toContain('Holzbau &lt;Müller&gt; &amp; Söhne')
    expect(html).toContain('Öhringen, 10. November 2026')
    expect(html).toContain('<h1 class="subject">Kurze Idee für Ihre Zimmerei</h1>')
  })
})

describe('checking a real (local test) inbox', () => {
  const require = createRequire(import.meta.url)
  const hoodiecrow = require('hoodiecrow-imap') as (options: unknown) => { listen: (port: number, cb: () => void) => void; close: () => void }
  const port = 23000 + Math.floor(Math.random() * 1000)
  let server: ReturnType<typeof hoodiecrow>

  const raw = (options: Record<string, unknown>): Promise<string> =>
    new Promise((resolve, reject) => new MailComposer(options).compile().build((error, message) => (error ? reject(error) : resolve(message.toString('binary')))))

  beforeAll(async () => {
    const today = new Date()
    const messages = [
      { raw: await raw({ from: 'Herr Holz <info@holz.example>', to: 'ich@dulidan.example', subject: 'Re: Kurze Idee', inReplyTo: '<sent1@dulidan.example>', date: today, text: 'Gerne, rufen Sie an.' }) },
      {
        raw: await raw({
          from: 'Mail Delivery System <MAILER-DAEMON@mail.example>',
          to: 'ich@dulidan.example',
          subject: 'Mail delivery failed: returning message to sender',
          date: today,
          text: 'This message could not be delivered.\nOriginal message: Message-ID: <sent2@dulidan.example>\nTo: kaputt@nirgends.example'
        })
      },
      { raw: await raw({ from: 'Newsletter <news@shop.example>', to: 'ich@dulidan.example', subject: 'Angebote', date: today, text: 'Werbung' }) }
    ]
    server = hoodiecrow({
      plugins: ['ID', 'SASL-IR', 'AUTH-PLAIN', 'NAMESPACE', 'IDLE', 'ENABLE', 'LITERALPLUS', 'UNSELECT', 'SPECIAL-USE', 'MOVE', 'UIDPLUS'],
      users: { tester: { password: 'geheim' } },
      storage: { INBOX: { messages: messages.map((message) => ({ ...message, flags: [], internaldate: today })) } }
    })
    await new Promise<void>((resolve) => server.listen(port, resolve))
  })

  afterAll(() => server?.close())

  it('marks the reply and the bounce, leaves everything else alone', async () => {
    const store = new RadarStore(join(mkdtempSync(join(tmpdir(), 'radar-replies-')), 'radar-data.json'))
    await store.load()
    await store.addLeads([
      { name: 'Zimmerei Holz', branche: 'Zimmerei', address: 'A 1, 1 X', phone: null, website: null },
      { name: 'Zimmerei Kaputt', branche: 'Zimmerei', address: 'B 2, 2 Y', phone: null, website: null },
      { name: 'Zimmerei Still', branche: 'Zimmerei', address: 'C 3, 3 Z', phone: null, website: null }
    ])
    const [holz, kaputt, still] = store.leads()
    const yesterday = Date.now() - DAY
    await store.updateLead(holz!.id, { email: 'info@holz.example', status: 'kontaktiert', contactedAt: yesterday, messageId: '<sent1@dulidan.example>' })
    await store.updateLead(kaputt!.id, { email: 'kaputt@nirgends.example', status: 'kontaktiert', contactedAt: yesterday, messageId: '<sent2@dulidan.example>' })
    await store.updateLead(still!.id, { email: 'still@ruhe.example', status: 'kontaktiert', contactedAt: yesterday, messageId: '<sent3@dulidan.example>' })

    const result = await checkReplies({ host: '127.0.0.1', port, secure: false, user: 'tester', pass: 'geheim', allowInsecureTls: true }, store)
    expect(result).toEqual({ replies: 1, bounces: 1, checked: 3 })
    const byName = Object.fromEntries(store.leads().map((item) => [item.name, item]))
    expect(byName['Zimmerei Holz']).toMatchObject({ status: 'antwort', replySubject: 'Re: Kurze Idee' })
    expect(byName['Zimmerei Kaputt']?.status).toBe('unzustellbar')
    expect(byName['Zimmerei Still']?.status).toBe('kontaktiert')
  })
})
