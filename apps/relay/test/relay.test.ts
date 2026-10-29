import { describe, expect, it } from 'vitest'
import { can, FEATURES } from '../src/renderer/src/features'
import { formatAddressList, parseAddressList } from '../src/renderer/src/mail/addresses'
import { prefixSubject, replyReferences, replyRecipients, signatureToHtml } from '../src/renderer/src/mail/quote'

describe('modes', () => {
  it('basic mode has only the listed functions', () => {
    const basic = (Object.keys(FEATURES) as Array<keyof typeof FEATURES>).filter((id) => can(id, 'basic'))
    expect(basic).toEqual(['inbox', 'read', 'reply', 'newMail', 'attachments', 'trash', 'calendarMonth', 'createEvent'])
  })

  it('expert has everything except April, pro has April too', () => {
    expect(can('forward', 'expert')).toBe(true)
    expect(can('calendarWeek', 'expert')).toBe(true)
    expect(can('april', 'expert')).toBe(false)
    expect(can('april', 'pro')).toBe(true)
    expect(can('search', 'pro')).toBe(true)
  })
})

describe('addresses', () => {
  it('reads lists with names, quotes and duplicates', () => {
    const result = parseAddressList('Anna <anna@example.com>, bernd@example.com; "Müller, Jo" <jo@example.com>, ANNA@example.com')
    expect(result.addresses).toEqual([
      { name: 'Anna', address: 'anna@example.com' },
      { name: '', address: 'bernd@example.com' },
      { name: 'Müller, Jo', address: 'jo@example.com' }
    ])
    expect(result.invalid).toEqual([])
    expect(parseAddressList('kein-at, a@b').invalid).toEqual(['kein-at', 'a@b'])
  })

  it('writes lists back so they can be read again', () => {
    const list = [
      { name: 'Müller, Jo', address: 'jo@example.com' },
      { name: '', address: 'x@example.com' }
    ]
    expect(parseAddressList(formatAddressList(list)).addresses).toEqual(list)
  })
})

describe('replies', () => {
  const mail = {
    from: { name: 'Anna', address: 'anna@example.com' },
    replyTo: [],
    to: [
      { name: 'Ich', address: 'info@dulidan-studios.com' },
      { name: 'Bernd', address: 'bernd@example.com' }
    ],
    cc: [{ name: 'Clara', address: 'clara@example.com' }]
  }

  it('answers the sender, or everyone except me', () => {
    expect(replyRecipients(mail, ['INFO@dulidan-studios.com'], false)).toEqual({ to: [mail.from], cc: [] })
    const all = replyRecipients(mail, ['info@dulidan-studios.com'], true)
    expect(all.to.map((a) => a.address)).toEqual(['anna@example.com', 'bernd@example.com'])
    expect(all.cc.map((a) => a.address)).toEqual(['clara@example.com'])
  })

  it('uses Reply-To when the sender asks for it', () => {
    expect(replyRecipients({ ...mail, replyTo: [{ name: '', address: 'team@example.com' }] }, [], false).to[0]!.address).toBe('team@example.com')
  })

  it('prefixes subjects once and keeps the thread references', () => {
    expect(prefixSubject('Angebot', 'Re: ')).toBe('Re: Angebot')
    expect(prefixSubject('AW: Angebot', 'Re: ')).toBe('AW: Angebot')
    expect(prefixSubject('WG: Angebot', 'Fwd: ')).toBe('WG: Angebot')
    expect(replyReferences({ messageId: '<b@x>', references: ['<a@x>'] })).toEqual(['<a@x>', '<b@x>'])
  })

  it('turns the signature into safe HTML', () => {
    expect(signatureToHtml('Max <Chef>\nTel. 123')).toBe('<p>--<br>Max &lt;Chef&gt;<br>Tel. 123</p>')
    expect(signatureToHtml('  ')).toBe('')
  })
})
