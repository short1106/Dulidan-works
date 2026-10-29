/**
 * Messages between the Radar window and the main process.
 * Only plain data crosses the bridge. Passwords and keys go in, but are never sent back.
 */
import type { Settings } from '@dulidan/core'
import type { Lead, LeadStatus } from '../main/leads'
import type { SendProgress } from '../main/outbox'

export type { Lead, LeadStatus, SendProgress }

export interface RadarConfig {
  branche: string
  ort: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  senderName: string
  senderEmail: string
  dailyLimit: number
  pauseMinSeconds: number
  pauseMaxSeconds: number
  templateId: string
  /** Shown as "saved", the key itself is never sent to the window. */
  hasPlacesKey: boolean
  hasSmtpPassword: boolean
}

export type RadarConfigPatch = Partial<Omit<RadarConfig, 'hasPlacesKey' | 'hasSmtpPassword'>>

export interface SearchResult {
  found: number
  added: number
  message: string
}

export interface SmtpTestResult {
  ok: boolean
  message: string
}

export interface TemplateInfo {
  id: string
  label: string
}

export interface MailPreview {
  subject: string
  body: string
  html: string
  /** Set when the company has no e-mail address yet, so the preview is only a sample. */
  hasAddress: boolean
}

export interface RadarApi {
  appInfo: () => Promise<{ name: string; version: string }>
  settings: {
    get: () => Promise<Settings>
    update: (patch: Partial<Settings>) => Promise<Settings>
  }
  config: {
    get: () => Promise<RadarConfig>
    update: (patch: RadarConfigPatch) => Promise<RadarConfig>
    saveSecrets: (secrets: { placesKey?: string; smtpPassword?: string }) => Promise<RadarConfig>
  }
  smtp: { test: () => Promise<SmtpTestResult> }
  search: { run: () => Promise<SearchResult> }
  leads: {
    list: () => Promise<Lead[]>
    update: (id: string, patch: { status?: LeadStatus; note?: string; email?: string | null }) => Promise<Lead[]>
    remove: (id: string) => Promise<Lead[]>
    checkWebsite: (id: string) => Promise<Lead[]>
  }
  blocklist: {
    get: () => Promise<string[]>
    set: (entries: string[]) => Promise<string[]>
  }
  templates: {
    list: () => Promise<TemplateInfo[]>
    preview: (templateId: string, leadId: string | null) => Promise<MailPreview>
  }
  send: {
    start: (leadIds: string[], templateId: string) => Promise<SendProgress>
    stop: () => Promise<SendProgress>
    status: () => Promise<SendProgress>
    onProgress: (listener: (progress: SendProgress) => void) => () => void
  }
}

export const IPC = {
  appInfo: 'radar:app-info',
  settingsGet: 'radar:settings-get',
  settingsUpdate: 'radar:settings-update',
  configGet: 'radar:config-get',
  configUpdate: 'radar:config-update',
  configSecrets: 'radar:config-secrets',
  smtpTest: 'radar:smtp-test',
  searchRun: 'radar:search-run',
  leadsList: 'radar:leads-list',
  leadsUpdate: 'radar:leads-update',
  leadsRemove: 'radar:leads-remove',
  leadsCheckWebsite: 'radar:leads-check-website',
  blocklistGet: 'radar:blocklist-get',
  blocklistSet: 'radar:blocklist-set',
  templatesList: 'radar:templates-list',
  templatesPreview: 'radar:templates-preview',
  sendStart: 'radar:send-start',
  sendStop: 'radar:send-stop',
  sendStatus: 'radar:send-status',
  sendProgress: 'radar:send-progress'
} as const
