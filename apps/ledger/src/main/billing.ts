import { DEFAULT_DATEV, normalizeDatev, type DatevSettings } from './datev'
import { DEFAULT_PAYMENT_TERM_DAYS } from './payments'

/** Rules for payments and the export for the tax advisor. */
export interface BillingSettings {
  paymentTermDays: number
  /** Fee added to the 1. and 2. Mahnung (not to the first, friendly reminder). 0 = none. */
  reminderFeeCents: number
  datev: DatevSettings
}

export const DEFAULT_BILLING: BillingSettings = { paymentTermDays: DEFAULT_PAYMENT_TERM_DAYS, reminderFeeCents: 0, datev: DEFAULT_DATEV }

export function normalizeBilling(raw: unknown): BillingSettings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<BillingSettings>
  const days = Number(input.paymentTermDays)
  const fee = Number(input.reminderFeeCents)
  return {
    paymentTermDays: Number.isInteger(days) && days >= 0 && days <= 120 ? days : DEFAULT_PAYMENT_TERM_DAYS,
    reminderFeeCents: Number.isInteger(fee) && fee >= 0 && fee <= 100_000 ? fee : 0,
    datev: normalizeDatev(input.datev)
  }
}
