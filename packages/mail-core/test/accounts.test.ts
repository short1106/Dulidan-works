import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { accountFromPreset, AccountStore, detectProvider, SecretStorageUnavailableError, validateAccount } from '../src/accounts'
import { fakeSecrets, tempDir } from './helpers'

let dir: string
let cleanup: () => Promise<void>
beforeEach(async () => ({ dir, cleanup } = await tempDir()))
afterEach(() => cleanup())

describe('account presets', () => {
  it('fills Gmail and IONOS servers so only address and password are needed', () => {
    const gmail = accountFromPreset('gmail', 'max@gmail.com')
    expect(gmail.imap).toEqual({ host: 'imap.gmail.com', port: 993, secure: true })
    expect(gmail.smtp.host).toBe('smtp.gmail.com')
    expect(gmail.saveSentCopy).toBe(false)
    const ionos = accountFromPreset('ionos', 'info@dulidan-studios.com')
    expect(ionos.imap.host).toBe('imap.ionos.de')
    expect(ionos.saveSentCopy).toBe(true)
    expect(validateAccount(gmail)).toEqual([])
  })

  it('recognizes Gmail addresses', () => {
    expect(detectProvider('Max@GMail.com')).toBe('gmail')
    expect(detectProvider('info@dulidan-studios.com')).toBe('custom')
  })

  it('reports invalid settings', () => {
    const broken = { ...accountFromPreset('custom', 'kein-at-zeichen'), dailySendLimit: 0 }
    expect(validateAccount(broken)).toEqual(['email', 'imap', 'smtp', 'dailySendLimit'])
  })
})

describe('AccountStore', () => {
  it('stores two accounts and never writes the password in plain text', async () => {
    const store = new AccountStore(join(dir, 'accounts.json'), fakeSecrets)
    await store.load()
    const ionos = await store.add(accountFromPreset('ionos', 'info@dulidan-studios.com', 'Dulidan Studios'), 'geheim-IONOS-123')
    await store.add(accountFromPreset('gmail', 'max@gmail.com'), 'abcd efgh ijkl mnop')
    const file = await readFile(join(dir, 'accounts.json'), 'utf8')
    expect(file).not.toContain('geheim-IONOS-123')
    expect(file).not.toContain('abcd efgh')
    expect(JSON.stringify(store.list())).not.toContain('secret')

    const reloaded = new AccountStore(join(dir, 'accounts.json'), fakeSecrets)
    expect(await reloaded.load()).toHaveLength(2)
    expect(reloaded.password(ionos.id)).toBe('geheim-IONOS-123')
  })

  it('updates settings and keeps the password unless a new one is given', async () => {
    const store = new AccountStore(join(dir, 'accounts.json'), fakeSecrets)
    const account = await store.add(accountFromPreset('gmail', 'max@gmail.com'), 'alt')
    await store.update(account.id, { signature: '<p>Gruß</p>' })
    expect(store.password(account.id)).toBe('alt')
    await store.update(account.id, {}, 'neu')
    expect(store.password(account.id)).toBe('neu')
    expect(store.get(account.id)?.signature).toBe('<p>Gruß</p>')
  })

  it('refuses duplicates and removes accounts', async () => {
    const store = new AccountStore(join(dir, 'accounts.json'), fakeSecrets)
    const account = await store.add(accountFromPreset('gmail', 'max@gmail.com'), 'pw')
    await expect(store.add(accountFromPreset('gmail', 'MAX@gmail.com'), 'pw')).rejects.toThrow()
    await store.remove(account.id)
    expect(store.list()).toEqual([])
  })

  it('saves nothing without a secure key store', async () => {
    const store = new AccountStore(join(dir, 'accounts.json'), { ...fakeSecrets, isAvailable: () => false })
    await expect(store.add(accountFromPreset('gmail', 'max@gmail.com'), 'pw')).rejects.toBeInstanceOf(SecretStorageUnavailableError)
    expect(store.list()).toEqual([])
  })
})
