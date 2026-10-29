import { readFile } from 'node:fs/promises'
import { app, safeStorage } from 'electron'
import type { ServerLogin } from '@dulidan/mail-core'
import { atomicWriteFile, JsonFile } from '@dulidan/core/node'
import type { RadarConfig, RadarConfigPatch } from '../shared/api'

const DEFAULT_CONFIG: Omit<RadarConfig, 'hasPlacesKey' | 'hasSmtpPassword'> = {
  branche: 'Zimmerei',
  ort: 'Öhringen',
  smtpHost: 'smtp.ionos.de',
  smtpPort: 587,
  smtpUser: '',
  senderName: 'Shaquille El Moussaoui',
  senderEmail: '',
  dailyLimit: 20,
  pauseMinSeconds: 90,
  pauseMaxSeconds: 240,
  templateId: 'zimmerei'
}

type StoredConfig = Omit<RadarConfig, 'hasPlacesKey' | 'hasSmtpPassword'>

function normalizeConfig(raw: unknown): StoredConfig {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const text = (key: keyof StoredConfig): string => (typeof input[key] === 'string' ? (input[key] as string) : (DEFAULT_CONFIG[key] as string))
  const number = (key: keyof StoredConfig, min: number, max: number): number => {
    const value = input[key]
    const base = DEFAULT_CONFIG[key] as number
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : base
  }
  return {
    branche: text('branche'),
    ort: text('ort'),
    smtpHost: text('smtpHost'),
    smtpPort: number('smtpPort', 1, 65535),
    smtpUser: text('smtpUser'),
    senderName: text('senderName'),
    senderEmail: text('senderEmail'),
    dailyLimit: number('dailyLimit', 1, 200),
    pauseMinSeconds: number('pauseMinSeconds', 10, 3600),
    pauseMaxSeconds: number('pauseMaxSeconds', 10, 3600),
    templateId: text('templateId')
  }
}

interface StoredSecrets {
  placesKey?: string
  smtpPassword?: string
}

/**
 * Settings and the two passwords (Google key, mail password). Passwords are
 * encrypted with the key store of the system. Without a real key store they
 * are not saved at all.
 */
export class RadarConfigStore {
  private readonly file: JsonFile<StoredConfig>
  private secrets: StoredSecrets = {}

  constructor(
    configPath: string,
    private readonly secretsPath: string
  ) {
    this.file = new JsonFile<StoredConfig>(configPath, normalizeConfig)
  }

  async load(): Promise<void> {
    await this.file.load()
    try {
      this.secrets = JSON.parse(await readFile(this.secretsPath, 'utf8')) as StoredSecrets
    } catch {
      this.secrets = {}
    }
  }

  get(): RadarConfig {
    return { ...this.file.get(), hasPlacesKey: Boolean(this.secrets.placesKey), hasSmtpPassword: Boolean(this.secrets.smtpPassword) }
  }

  async update(patch: RadarConfigPatch): Promise<RadarConfig> {
    await this.file.update(patch)
    return this.get()
  }

  async saveSecrets(input: { placesKey?: string; smtpPassword?: string }): Promise<RadarConfig> {
    if (input.placesKey !== undefined || input.smtpPassword !== undefined) {
      if (!secretStorageAvailable()) throw new Error('Auf diesem Rechner gibt es keinen sicheren Speicher für Passwörter. Deshalb speichert Radar nichts.')
    }
    const next: StoredSecrets = { ...this.secrets }
    if (input.placesKey !== undefined) next.placesKey = input.placesKey.trim() ? encrypt(input.placesKey.trim()) : undefined
    if (input.smtpPassword !== undefined) next.smtpPassword = input.smtpPassword ? encrypt(input.smtpPassword) : undefined
    await atomicWriteFile(this.secretsPath, JSON.stringify(next))
    this.secrets = next
    return this.get()
  }

  placesKey(): string | null {
    return this.secrets.placesKey ? decrypt(this.secrets.placesKey) : null
  }

  /** Login for the mail server, or null if the settings are not complete. */
  smtpLogin(): ServerLogin | null {
    const config = this.file.get()
    const pass = this.secrets.smtpPassword ? decrypt(this.secrets.smtpPassword) : ''
    if (!config.smtpHost || !config.smtpUser || !pass) return null
    return { host: config.smtpHost, port: config.smtpPort, secure: config.smtpPort === 465, user: config.smtpUser, pass }
  }
}

export function radarDataDir(): string {
  return app.getPath('userData')
}

export function secretStorageAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  // On Linux without a key ring Electron would fall back to a fixed key: not safe enough.
  return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'
}

function encrypt(plain: string): string {
  return safeStorage.encryptString(plain).toString('base64')
}

function decrypt(cipher: string): string {
  return safeStorage.decryptString(Buffer.from(cipher, 'base64'))
}
