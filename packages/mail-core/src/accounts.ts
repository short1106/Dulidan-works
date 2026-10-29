import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { atomicWriteFile } from '@dulidan/core/node'

/**
 * Mail accounts: server settings and the password, which is only ever
 * stored encrypted. Encryption is done by a SecretBox the app provides
 * (in Electron: safeStorage, i.e. the key store of the operating system).
 */

export interface ServerSettings {
  host: string
  port: number
  /** true: encrypted from the start (993/465). false: STARTTLS on a plain port (143/587). */
  secure: boolean
}

export type ProviderId = 'gmail' | 'ionos' | 'custom'

export interface AccountSettings {
  id: string
  /** Name shown to recipients, e.g. "Dulidan Studios". */
  displayName: string
  email: string
  /** Login name, usually the email address. */
  username: string
  provider: ProviderId
  imap: ServerSettings
  smtp: ServerSettings
  /** Store a copy of sent mails in the Sent folder (Gmail does this itself). */
  saveSentCopy: boolean
  /** Signature as simple HTML, added below new mails. */
  signature: string
  /** Optional limit of mails per day, e.g. for Radar. null = no limit. */
  dailySendLimit: number | null
}

export interface ProviderPreset {
  id: ProviderId
  label: string
  imap: ServerSettings
  smtp: ServerSettings
  saveSentCopy: boolean
  /** Needs an app password instead of the normal password. */
  appPassword: boolean
}

export const PROVIDER_PRESETS: Record<Exclude<ProviderId, 'custom'>, ProviderPreset> = {
  gmail: {
    id: 'gmail',
    label: 'Gmail',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    saveSentCopy: false,
    appPassword: true
  },
  ionos: {
    id: 'ionos',
    label: 'IONOS',
    imap: { host: 'imap.ionos.de', port: 993, secure: true },
    smtp: { host: 'smtp.ionos.de', port: 465, secure: true },
    saveSentCopy: true,
    appPassword: false
  }
}

/** Guesses the provider from the address; own domains (like IONOS) stay "custom". */
export function detectProvider(email: string): ProviderId {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail'
  if (/^(ionos|online)\.(de|com)$/.test(domain)) return 'ionos'
  return 'custom'
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim())
}

export type AccountInput = Omit<AccountSettings, 'id'>

export type AccountField = 'email' | 'username' | 'displayName' | 'imap' | 'smtp' | 'dailySendLimit'

/** Checks an account before saving. Returns the invalid fields. */
export function validateAccount(input: AccountInput): AccountField[] {
  const errors: AccountField[] = []
  const serverOk = (server: ServerSettings): boolean =>
    /^[a-z0-9.-]+$/i.test(server.host.trim()) && Number.isInteger(server.port) && server.port > 0 && server.port < 65536
  if (!isValidEmail(input.email)) errors.push('email')
  if (!input.username.trim()) errors.push('username')
  if (input.displayName.length > 120) errors.push('displayName')
  if (!serverOk(input.imap)) errors.push('imap')
  if (!serverOk(input.smtp)) errors.push('smtp')
  if (input.dailySendLimit !== null && (!Number.isInteger(input.dailySendLimit) || input.dailySendLimit < 1)) errors.push('dailySendLimit')
  return errors
}

/** Fills server settings from a preset; only address and password are left to the user. */
export function accountFromPreset(provider: ProviderId, email: string, displayName = ''): AccountInput {
  const preset = provider === 'custom' ? null : PROVIDER_PRESETS[provider]
  return {
    displayName,
    email: email.trim(),
    username: email.trim(),
    provider,
    imap: preset ? { ...preset.imap } : { host: '', port: 993, secure: true },
    smtp: preset ? { ...preset.smtp } : { host: '', port: 465, secure: true },
    saveSentCopy: preset ? preset.saveSentCopy : true,
    signature: '',
    dailySendLimit: null
  }
}

/** Encrypts and decrypts secrets. Provided by the app (Electron safeStorage). */
export interface SecretBox {
  /** False if the system has no secure key store; then no password is saved. */
  isAvailable(): boolean
  encrypt(plain: string): string
  decrypt(cipher: string): string
}

export class SecretStorageUnavailableError extends Error {
  constructor() {
    super('No secure key store available on this system.')
    this.name = 'SecretStorageUnavailableError'
  }
}

interface StoredAccount extends AccountSettings {
  /** The password, encrypted by the SecretBox. Never plain text. */
  secret: string
}

interface AccountsFile {
  version: 1
  accounts: StoredAccount[]
}

/** Keeps the account list in accounts.json, passwords only encrypted. */
export class AccountStore {
  private accounts: StoredAccount[] = []

  constructor(
    private readonly file: string,
    private readonly secrets: SecretBox
  ) {}

  async load(): Promise<AccountSettings[]> {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8')) as Partial<AccountsFile>
      this.accounts = Array.isArray(data.accounts) ? data.accounts.filter((item) => item && typeof item.id === 'string' && typeof item.secret === 'string') : []
    } catch {
      this.accounts = []
    }
    return this.list()
  }

  /** All accounts, without any secret. */
  list(): AccountSettings[] {
    return this.accounts.map(({ secret: _secret, ...account }) => ({ ...account }))
  }

  get(id: string): AccountSettings | undefined {
    return this.list().find((account) => account.id === id)
  }

  async add(input: AccountInput, password: string): Promise<AccountSettings> {
    this.ensureValid(input)
    if (this.accounts.some((account) => account.email.toLowerCase() === input.email.trim().toLowerCase())) {
      throw new Error('An account with this address already exists.')
    }
    const account: StoredAccount = { ...input, email: input.email.trim(), id: randomUUID(), secret: this.encrypt(password) }
    this.accounts.push(account)
    await this.save()
    return this.get(account.id)!
  }

  /** Changes settings; the password only if a new one is given. */
  async update(id: string, patch: Partial<AccountInput>, password?: string): Promise<AccountSettings> {
    const index = this.accounts.findIndex((account) => account.id === id)
    if (index < 0) throw new Error('Unknown account')
    const current = this.accounts[index]!
    const next: StoredAccount = { ...current, ...patch, id, secret: password ? this.encrypt(password) : current.secret }
    this.ensureValid(next)
    this.accounts[index] = next
    await this.save()
    return this.get(id)!
  }

  async remove(id: string): Promise<void> {
    this.accounts = this.accounts.filter((account) => account.id !== id)
    await this.save()
  }

  /** The decrypted password, only for logging in to the mail server. */
  password(id: string): string {
    const account = this.accounts.find((item) => item.id === id)
    if (!account) throw new Error('Unknown account')
    return this.secrets.decrypt(account.secret)
  }

  private encrypt(password: string): string {
    if (!this.secrets.isAvailable()) throw new SecretStorageUnavailableError()
    if (!password) throw new Error('Password is empty')
    return this.secrets.encrypt(password)
  }

  private ensureValid(input: AccountInput): void {
    const errors = validateAccount(input)
    if (errors.length > 0) throw new Error(`Invalid account settings: ${errors.join(', ')}`)
  }

  private async save(): Promise<void> {
    const data: AccountsFile = { version: 1, accounts: this.accounts }
    await atomicWriteFile(this.file, JSON.stringify(data, null, 2))
  }
}
