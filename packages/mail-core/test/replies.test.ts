import { describe, expect, it } from 'vitest'
import { findOriginalId, normalizeMessageId, SentLog } from '../src/sentLog'
import { openDatabase } from '../src/sqlite'

const sent = { messageId: '<abc@dulidan-studios.com>', accountId: 'a1', to: [{ name: '', address: 'kunde@example.com' }], subject: 'Angebot', sentAt: Date.now(), tag: 'radar' }

describe('reply detection', () => {
  it('matches In-Reply-To first, then References from newest to oldest', () => {
    const isSent = (id: string): boolean => id === 'abc@dulidan-studios.com' || id === 'old@x'
    expect(findOriginalId({ inReplyTo: '<ABC@dulidan-studios.com>', references: [] }, isSent)).toBe('abc@dulidan-studios.com')
    expect(findOriginalId({ inReplyTo: '<other@x>', references: ['<old@x>', '<abc@dulidan-studios.com>'] }, isSent)).toBe('abc@dulidan-studios.com')
    expect(findOriginalId({ inReplyTo: null, references: [] }, isSent)).toBeNull()
    expect(normalizeMessageId(' <A@B> ')).toBe('a@b')
  })

  it('reports a reply once, with the original mail', () => {
    const log = new SentLog(openDatabase(':memory:'))
    log.record(sent)
    const reply = { id: 7, messageId: '<r1@example.com>', inReplyTo: '<abc@dulidan-studios.com>', references: ['<abc@dulidan-studios.com>'], from: { name: 'Kunde', address: 'kunde@example.com' }, subject: 'Re: Angebot', date: Date.now() }
    const event = log.detectReply(reply)
    expect(event?.original).toMatchObject({ messageId: 'abc@dulidan-studios.com', tag: 'radar', subject: 'Angebot' })
    expect(event?.replyId).toBe(7)
    expect(log.detectReply(reply)).toBeNull()
    expect(log.detectReply({ ...reply, id: 8, messageId: '<x@y>', inReplyTo: '<unknown@y>', references: [] })).toBeNull()
  })

  it('counts mails sent today in Berlin time', () => {
    const log = new SentLog(openDatabase(':memory:'))
    // 2026-07-10: Berlin is UTC+2, so the day starts at 22:00 UTC the evening before.
    log.record({ ...sent, messageId: '<1@x>', sentAt: Date.UTC(2026, 6, 9, 21, 59) }) // 23:59 on 9 July in Berlin
    log.record({ ...sent, messageId: '<2@x>', sentAt: Date.UTC(2026, 6, 9, 22, 1) }) // 00:01 on 10 July
    log.record({ ...sent, messageId: '<3@x>', sentAt: Date.UTC(2026, 6, 10, 12, 0) })
    expect(log.countToday('a1', Date.UTC(2026, 6, 10, 15, 0))).toBe(2)
    expect(log.countToday('other', Date.UTC(2026, 6, 10, 15, 0))).toBe(0)
  })
})
