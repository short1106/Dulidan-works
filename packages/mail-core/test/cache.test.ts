import { describe, expect, it } from 'vitest'
import { buildSearchQuery, MailCache, makeSnippet } from '../src/cache'
import { openDatabase } from '../src/sqlite'
import { mail } from './helpers'

function cache(): MailCache {
  const c = new MailCache(openDatabase(':memory:'))
  c.setFolders('a1', [
    { path: 'INBOX', name: 'INBOX', specialUse: 'inbox' },
    { path: 'Papierkorb', name: 'Papierkorb', specialUse: 'trash' },
    { path: 'Gesendet', name: 'Gesendet', specialUse: 'sent' },
    { path: 'Projekte', name: 'Projekte', specialUse: null }
  ])
  return c
}

describe('MailCache', () => {
  it('lists folders in a fixed order with unread counts', () => {
    const c = cache()
    c.upsertMessages('a1', 'INBOX', [mail(1), mail(2, { seen: true })])
    const folders = c.folders('a1')
    expect(folders.map((f) => f.path)).toEqual(['INBOX', 'Gesendet', 'Projekte', 'Papierkorb'])
    expect(folders[0]).toMatchObject({ unread: 1, total: 2 })
    expect(c.findFolder('a1', 'trash')).toBe('Papierkorb')
  })

  it('stores mails once, newest first, and updates the read state', () => {
    const c = cache()
    expect(c.upsertMessages('a1', 'INBOX', [mail(1), mail(2)])).toHaveLength(2)
    expect(c.upsertMessages('a1', 'INBOX', [mail(2, { seen: true }), mail(3)])).toHaveLength(1)
    const list = c.list('a1', 'INBOX')
    expect(list.map((m) => m.uid)).toEqual([3, 2, 1])
    expect(list[1]!.seen).toBe(true)
    expect(c.get(list[0]!.id)?.text).toBe('Text der Mail 3')
  })

  it('searches sender, subject and text, also with umlauts and word beginnings', () => {
    const c = cache()
    c.upsertMessages('a1', 'INBOX', [
      mail(1, { subject: 'Rechnung Oktober' }),
      mail(2, { from: { name: 'Jürgen Müller', address: 'jm@example.com' } }),
      mail(3, { text: 'Bitte das Angebot für die Küche prüfen' })
    ])
    expect(c.search('rech').map((m) => m.uid)).toEqual([1])
    expect(c.search('muller').map((m) => m.uid)).toEqual([2])
    expect(c.search('Küche angebot').map((m) => m.uid)).toEqual([3])
    expect(c.search('"); DROP TABLE messages; --')).toEqual([])
    expect(c.search('   ')).toEqual([])
  })

  it('forgets a folder when the server reports a new UIDVALIDITY', () => {
    const c = cache()
    c.upsertMessages('a1', 'INBOX', [mail(1)])
    c.setSyncState('a1', 'INBOX', { uidValidity: '100', lastUid: 1 })
    c.setSyncState('a1', 'INBOX', { uidValidity: '200', lastUid: 0 })
    expect(c.list('a1', 'INBOX')).toEqual([])
    expect(c.search('Betreff')).toEqual([])
  })

  it('removes mails gone from the server and keeps only the newest', () => {
    const c = cache()
    c.upsertMessages('a1', 'INBOX', [mail(1), mail(2), mail(3), mail(4)])
    c.removeUids('a1', 'INBOX', [2])
    c.prune('a1', 'INBOX', 2)
    expect(c.list('a1', 'INBOX').map((m) => m.uid)).toEqual([4, 3])
  })

  it('removes deleted folders and whole accounts', () => {
    const c = cache()
    c.upsertMessages('a1', 'Projekte', [mail(1)])
    c.setFolders('a1', [{ path: 'INBOX', name: 'INBOX', specialUse: 'inbox' }])
    expect(c.list('a1', 'Projekte')).toEqual([])
    c.removeAccount('a1')
    expect(c.folders('a1')).toEqual([])
  })

  it('builds safe search queries and snippets', () => {
    expect(buildSearchQuery('Rechnung 2026')).toBe('"rechnung"* "2026"*')
    expect(buildSearchQuery('***')).toBeNull()
    expect(makeSnippet('  Hallo\n\n  Welt  ')).toBe('Hallo Welt')
  })
})
