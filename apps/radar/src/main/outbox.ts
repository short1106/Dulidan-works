import { buildMessage, sendRaw, type OutgoingMail, type ServerLogin } from '@dulidan/mail-core'
import type { Lead, RadarStore } from './leads'
import { pauseMs, remainingToday } from './logic'
import { renderLeadMail, type RadarTemplate } from './templates'

export interface SendSettings {
  senderName: string
  senderEmail: string
  dailyLimit: number
  pauseMinSeconds: number
  pauseMaxSeconds: number
}

export interface SendProgress {
  state: 'laeuft' | 'fertig' | 'gestoppt' | 'fehler'
  total: number
  done: number
  skipped: number
  current: string | null
  message: string | null
}

export interface OutboxDeps {
  store: RadarStore
  login: () => ServerLogin | null
  settings: () => SendSettings
  report: (progress: SendProgress) => void
  /** Injected for tests; the app uses the real sending. */
  send?: (login: ServerLogin, mail: OutgoingMail) => Promise<void>
  wait?: (ms: number) => Promise<void>
}

const realWait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Sends one campaign at a time: one mail after the other, with a random pause
 * in between, never more than the daily limit, never to a blocked address and
 * never twice to the same company. Can be stopped at any time.
 */
export class Outbox {
  private running = false
  private stopRequested = false
  private progress: SendProgress = { state: 'fertig', total: 0, done: 0, skipped: 0, current: null, message: null }

  constructor(private readonly deps: OutboxDeps) {}

  status(): SendProgress {
    return this.progress
  }

  stop(): void {
    this.stopRequested = true
  }

  async start(leadIds: string[], template: RadarTemplate): Promise<void> {
    if (this.running) throw new Error('Es läuft schon ein Versand.')
    const login = this.deps.login()
    if (!login) throw new Error('Bitte zuerst die Mail-Einstellungen eintragen und testen.')

    const settings = this.deps.settings()
    const leads = leadIds
      .map((id) => this.deps.store.leads().find((lead) => lead.id === id))
      .filter((lead): lead is Lead => Boolean(lead))
    this.running = true
    this.stopRequested = false
    this.update({ state: 'laeuft', total: leads.length, done: 0, skipped: 0, current: null, message: null })

    const send = this.deps.send ?? ((smtp: ServerLogin, mail: OutgoingMail) => this.sendReal(smtp, mail))
    const wait = this.deps.wait ?? realWait
    let sentInThisRun = 0

    try {
      for (const lead of leads) {
        if (this.stopRequested) break
        const skipReason = this.skipReason(lead)
        if (skipReason) {
          this.update({ skipped: this.progress.skipped + 1, message: skipReason })
          continue
        }
        if (remainingToday(settings.dailyLimit, this.deps.store.sentToday()) < 1) {
          this.update({ state: 'gestoppt', message: `Das Tageslimit von ${settings.dailyLimit} Mails ist erreicht. Morgen geht es weiter.` })
          return
        }

        this.update({ current: lead.name })
        const { mail, html } = renderLeadMail(template, null, lead.name)
        const outgoing: OutgoingMail = {
          from: { name: settings.senderName, address: settings.senderEmail },
          to: [{ name: lead.name, address: lead.email ?? '' }],
          cc: [],
          bcc: [],
          subject: mail.subject,
          html,
          text: mail.body,
          attachments: []
        }
        try {
          await send(login, outgoing)
          await this.deps.store.countSent()
          await this.deps.store.updateLead(lead.id, { status: 'kontaktiert' })
          sentInThisRun++
          this.update({ done: this.progress.done + 1, message: null })
        } catch (error) {
          this.update({ state: 'fehler', message: `Versand an ${lead.name} fehlgeschlagen: ${errorText(error)}` })
          return
        }

        const more = leads.slice(leads.indexOf(lead) + 1).some((next) => !this.skipReason(next))
        if (more && !this.stopRequested) {
          await wait(pauseMs(settings.pauseMinSeconds, settings.pauseMaxSeconds))
        }
      }
      this.update({ state: this.stopRequested ? 'gestoppt' : 'fertig', current: null, message: sentInThisRun === 0 ? 'Keine Mail verschickt.' : null })
    } finally {
      this.running = false
    }
  }

  /** Why a lead must not be mailed now, or null if it can be mailed. */
  skipReason(lead: Lead): string | null {
    if (lead.status !== 'neu') return `${lead.name}: schon kontaktiert oder erledigt.`
    if (!lead.email) return `${lead.name}: keine Mailadresse bekannt.`
    if (this.deps.store.isBlocked(lead.email)) return `${lead.name}: steht auf der Sperrliste.`
    return null
  }

  private async sendReal(login: ServerLogin, mail: OutgoingMail): Promise<void> {
    const { raw } = await buildMessage(mail)
    await sendRaw(login, mail, raw)
  }

  private update(patch: Partial<SendProgress>): void {
    this.progress = { ...this.progress, ...patch }
    this.deps.report(this.progress)
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
