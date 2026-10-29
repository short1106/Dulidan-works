import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractEmails, greeting, isBlocked, isForeignBusiness, pauseMs, pickEmail, remainingToday, dayKey } from '../src/main/logic'
import { normalizeData, RadarStore } from '../src/main/leads'
import { Outbox, type SendProgress, type SendSettings } from '../src/main/outbox'
import { renderLeadMail, templateById } from '../src/main/templates'
import type { ServerLogin } from '@dulidan/mail-core'

/** A fresh folder for each test. Real user data is never touched. */
function testFolder(): string {
  return mkdtempSync(join(tmpdir(), 'radar-test-'))
}

const settings: SendSettings = {
  senderName: 'Test Absender',
  senderEmail: 'absender@example.test',
  dailyLimit: 20,
  pauseMinSeconds: 90,
  pauseMaxSeconds: 240
}

const login: ServerLogin = { host: 'smtp.example.test', port: 587, secure: false, user: 'u', pass: 'p' }

async function storeWith(leads: Array<{ name: string; email: string | null; status?: 'neu' | 'kontaktiert' }>, blocklist: string[] = []): Promise<RadarStore> {
  const store = new RadarStore(join(testFolder(), 'data.json'))
  await store.load()
  await store.addLeads(leads.map((lead, index) => ({ name: lead.name, branche: 'Zimmerei', address: `Straße ${index}`, phone: null, website: null })))
  for (const [index, lead] of leads.entries()) {
    const id = store.leads()[index].id
    await store.updateLead(id, { email: lead.email, status: lead.status ?? 'neu' })
  }
  await store.setBlocklist(blocklist)
  return store
}

describe('E-Mail-Adressen auf Webseiten', () => {
  it('findet Adressen und entfernt doppelte', () => {
    const page = '<a href="mailto:info@zimmerei-hofmann.de">Mail</a> info@zimmerei-hofmann.de'
    expect(extractEmails(page)).toEqual(['info@zimmerei-hofmann.de'])
  })

  it('liest Adressen, die mit &#64; oder [at] verschleiert sind', () => {
    expect(extractEmails('kontakt&#64;holz-bau.de')).toEqual(['kontakt@holz-bau.de'])
    expect(extractEmails('kontakt [at] holz-bau.de')).toEqual(['kontakt@holz-bau.de'])
  })

  it('ignoriert Adressen von Werkzeugen und Bildern', () => {
    const page = 'sentry@x.io noreply@firma.de logo@bild.png user@example.com'
    expect(extractEmails(page)).toEqual([])
  })

  it('nimmt bevorzugt die Adresse der eigenen Domain und info@', () => {
    expect(pickEmail(['a@gmail.com', 'info@holz-bau.de', 'chef@holz-bau.de'], 'www.holz-bau.de')).toBe('info@holz-bau.de')
    expect(pickEmail(['a@gmail.com', 'chef@holz-bau.de'], 'holz-bau.de')).toBe('chef@holz-bau.de')
    expect(pickEmail([], 'holz-bau.de')).toBeNull()
  })
})

describe('Sperrliste und Ausschluss', () => {
  it('sperrt eine Adresse oder eine ganze Domain', () => {
    expect(isBlocked('Info@Firma.de', ['info@firma.de'])).toBe(true)
    expect(isBlocked('chef@firma.de', ['@firma.de'])).toBe(true)
    expect(isBlocked('chef@firma.de', ['info@firma.de'])).toBe(false)
    expect(isBlocked('chef@firma.de', ['# Kommentar'])).toBe(false)
  })

  it('schließt Firmen aus anderen Branchen aus', () => {
    expect(isForeignBusiness('Immobilien Hofmann')).toBe(true)
    expect(isForeignBusiness('Zimmerei Hofmann')).toBe(false)
  })
})

describe('Tageslimit und Pausen', () => {
  it('zählt die Restmenge herunter und nie unter null', () => {
    expect(remainingToday(20, 0)).toBe(20)
    expect(remainingToday(20, 20)).toBe(0)
    expect(remainingToday(20, 25)).toBe(0)
  })

  it('wählt eine Pause zwischen Minimum und Maximum', () => {
    expect(pauseMs(90, 240, () => 0)).toBe(90_000)
    expect(pauseMs(90, 240, () => 1)).toBe(240_000)
    expect(pauseMs(240, 90, () => 0.5)).toBe(165_000)
  })

  it('setzt den Tag als YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 9, 30, 12))).toBe('2026-10-30')
  })
})

describe('Anrede und Vorlagen', () => {
  it('nimmt die Anrede mit Nachnamen oder den Ersatz', () => {
    expect(greeting('Anna Holz', 'Guten Tag,')).toBe('Sehr geehrte/r Holz,')
    expect(greeting(null, 'Guten Tag,')).toBe('Guten Tag,')
  })

  it('füllt die Vorlage für eine Firma und lässt keine Platzhalter übrig', () => {
    const { mail, html } = renderLeadMail(templateById('zimmerei'), null, 'Holzbau Test')
    expect(mail.subject).toBe('Kurze Idee zu Ihrer Website')
    expect(mail.body.startsWith('Guten Tag,')).toBe(true)
    expect(mail.body).not.toContain('{anrede}')
    expect(mail.missing).toEqual([])
    expect(html.startsWith('<p>')).toBe(true)
  })
})

describe('Datenspeicher', () => {
  it('repariert beschädigte Daten, ohne abzustürzen', () => {
    const data = normalizeData({ leads: [{ nichts: true }, { id: 'a', name: 'Firma' }], blocklist: [1, 'x@y.de'], sentToday: 'viel' })
    expect(data.leads.map((lead) => lead.id)).toEqual(['a'])
    expect(data.blocklist).toEqual(['x@y.de'])
    expect(data.sentToday).toBe(0)
  })

  it('fügt jede Firma nur einmal hinzu', async () => {
    const store = new RadarStore(join(testFolder(), 'data.json'))
    await store.load()
    const place = { name: 'Holzbau Test', branche: 'Zimmerei', address: 'Musterweg 1', phone: null, website: null }
    expect(await store.addLeads([place, place])).toBe(1)
    expect(await store.addLeads([place])).toBe(0)
  })
})

describe('Versand', () => {
  it('schickt nur an neue Firmen mit Adresse und nicht an gesperrte', async () => {
    const store = await storeWith(
      [
        { name: 'Alpha Zimmerei', email: 'info@alpha.de' },
        { name: 'Beta Zimmerei', email: 'info@beta.de' },
        { name: 'Gamma Zimmerei', email: null },
        { name: 'Delta Zimmerei', email: 'chef@delta.de', status: 'kontaktiert' }
      ],
      ['info@beta.de']
    )
    const sent: string[] = []
    const reports: SendProgress[] = []
    const outbox = new Outbox({
      store,
      login: () => login,
      settings: () => settings,
      report: (progress) => reports.push(progress),
      send: async (_login, mail) => {
        sent.push(mail.to[0].address)
      },
      wait: async () => undefined
    })

    await outbox.start(store.leads().map((lead) => lead.id), templateById('zimmerei'))

    expect(sent).toEqual(['info@alpha.de'])
    expect(store.sentToday()).toBe(1)
    expect(store.leads().find((lead) => lead.name === 'Alpha Zimmerei')?.status).toBe('kontaktiert')
    expect(reports.at(-1)?.state).toBe('fertig')
    expect(reports.at(-1)?.skipped).toBe(3)
  })

  it('hört beim Tageslimit auf', async () => {
    const store = await storeWith([
      { name: 'Alpha Zimmerei', email: 'info@alpha.de' },
      { name: 'Beta Zimmerei', email: 'info@beta.de' }
    ])
    const sent: string[] = []
    const outbox = new Outbox({
      store,
      login: () => login,
      settings: () => ({ ...settings, dailyLimit: 1 }),
      report: () => undefined,
      send: async (_login, mail) => {
        sent.push(mail.to[0].address)
      },
      wait: async () => undefined
    })

    await outbox.start(store.leads().map((lead) => lead.id), templateById('zimmerei'))

    expect(sent).toHaveLength(1)
    expect(outbox.status().state).toBe('gestoppt')
    expect(outbox.status().message).toContain('Tageslimit')
  })

  it('stoppt bei einem Fehler und meldet ihn', async () => {
    const store = await storeWith([
      { name: 'Alpha Zimmerei', email: 'info@alpha.de' },
      { name: 'Beta Zimmerei', email: 'info@beta.de' }
    ])
    let calls = 0
    const outbox = new Outbox({
      store,
      login: () => login,
      settings: () => settings,
      report: () => undefined,
      send: async () => {
        calls++
        throw new Error('Server sagt nein')
      },
      wait: async () => undefined
    })

    await outbox.start(store.leads().map((lead) => lead.id), templateById('zimmerei'))

    expect(calls).toBe(1)
    expect(outbox.status().state).toBe('fehler')
    expect(outbox.status().message).toContain('Server sagt nein')
    expect(store.sentToday()).toBe(0)
  })

  it('verweigert den Start ohne Mail-Zugang', async () => {
    const store = await storeWith([{ name: 'Alpha Zimmerei', email: 'info@alpha.de' }])
    const outbox = new Outbox({ store, login: () => null, settings: () => settings, report: () => undefined })
    await expect(outbox.start([], templateById('zimmerei'))).rejects.toThrow('Mail-Einstellungen')
  })
})
