import { totals } from './logic'
import type { Document } from './store'

/**
 * Payments and reminders of an issued invoice. They never change the invoice
 * itself (an issued invoice stays frozen); they are kept next to it.
 */

export interface Payment {
  id: string
  /** ISO date, e.g. 2026-11-11. */
  date: string
  amountCents: number
  note: string
}

/** 1 = Zahlungserinnerung, 2 = 1. Mahnung, 3 = 2. Mahnung (the last one). */
export type ReminderLevel = 1 | 2 | 3

export interface Reminder {
  level: ReminderLevel
  date: string
  /** New deadline for the payment. */
  dueDate: string
  feeCents: number
}

export type PaymentState = 'offen' | 'teilweise' | 'bezahlt' | 'ueberfaellig'

export const DEFAULT_PAYMENT_TERM_DAYS = 14
/** Days the customer gets after a reminder. */
export const REMINDER_DAYS = 7

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export interface Balance {
  grossCents: number
  paidCents: number
  /** Still to pay; includes reminder fees. Never below zero. */
  openCents: number
  feesCents: number
  dueDate: string
  state: PaymentState
  /** Last reminder, if any. */
  reminder: Reminder | null
}

/** Where an issued invoice stands: paid, partly paid, open or overdue (on `today`). */
export function balanceOf(doc: Pick<Document, 'items' | 'date' | 'dueDate' | 'payments' | 'reminders'>, today: string, termDays = DEFAULT_PAYMENT_TERM_DAYS): Balance {
  const grossCents = totals(doc.items).grossCents
  const payments = doc.payments ?? []
  const reminders = doc.reminders ?? []
  const paidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0)
  const feesCents = reminders.reduce((sum, reminder) => sum + reminder.feeCents, 0)
  const openCents = Math.max(0, grossCents + feesCents - paidCents)
  const reminder = reminders.at(-1) ?? null
  const dueDate = reminder?.dueDate ?? doc.dueDate ?? addDays(doc.date, termDays)
  let state: PaymentState
  if (openCents === 0) state = 'bezahlt'
  else if (today > dueDate) state = 'ueberfaellig'
  else if (paidCents > 0) state = 'teilweise'
  else state = 'offen'
  return { grossCents, paidCents, openCents, feesCents, dueDate, state, reminder }
}

/** The next reminder level, or null if the last one (2. Mahnung) was already sent. */
export function nextReminderLevel(reminders: Reminder[] | undefined): ReminderLevel | null {
  const last = reminders?.at(-1)?.level ?? 0
  return last >= 3 ? null : ((last + 1) as ReminderLevel)
}

export const REMINDER_TITLES: Record<ReminderLevel, string> = { 1: 'Zahlungserinnerung', 2: '1. Mahnung', 3: '2. Mahnung' }

/** Only an issued invoice that is overdue and not fully paid may get a reminder. */
export function canRemind(doc: Pick<Document, 'kind' | 'status' | 'items' | 'date' | 'dueDate' | 'payments' | 'reminders'>, today: string, termDays?: number): boolean {
  if (doc.kind !== 'rechnung' || doc.status !== 'ausgestellt') return false
  return balanceOf(doc, today, termDays).state === 'ueberfaellig' && nextReminderLevel(doc.reminders) !== null
}
