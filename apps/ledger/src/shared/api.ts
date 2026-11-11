/**
 * Messages between the Ledger window and the main process.
 * Only plain data crosses the bridge.
 */
import type { Settings } from '@dulidan/core'
import type { CompanyData, Item } from '../main/logic'
import type { DatevSettings } from '../main/datev'
import type { Payment } from '../main/payments'
import type { BillingSettings, Customer, Document, DocumentKind } from '../main/store'

export type { BillingSettings, CompanyData, DatevSettings, Item, Customer, Document, DocumentKind, Payment }

export interface LedgerData {
  company: CompanyData
  customers: Customer[]
  documents: Document[]
  billing: BillingSettings
}

export interface LedgerApi {
  appInfo: () => Promise<{ name: string; version: string }>
  settings: {
    get: () => Promise<Settings>
    update: (patch: Partial<Settings>) => Promise<Settings>
  }
  data: { get: () => Promise<LedgerData> }
  company: { save: (company: CompanyData) => Promise<LedgerData> }
  customers: {
    save: (customer: Omit<Customer, 'id'> & { id?: string }) => Promise<LedgerData>
    remove: (id: string) => Promise<LedgerData>
  }
  documents: {
    create: (kind: DocumentKind, customerId: string | null) => Promise<LedgerData>
    update: (id: string, patch: Partial<Pick<Document, 'customerId' | 'items' | 'note' | 'date'>>) => Promise<LedgerData>
    remove: (id: string) => Promise<LedgerData>
    issue: (id: string) => Promise<LedgerData>
    cancel: (id: string) => Promise<LedgerData>
    toInvoice: (id: string) => Promise<LedgerData>
    addPayment: (id: string, payment: Omit<Payment, 'id'>) => Promise<LedgerData>
    removePayment: (id: string, paymentId: string) => Promise<LedgerData>
    /** Writes down the next reminder level for an overdue invoice. */
    addReminder: (id: string) => Promise<LedgerData>
  }
  billing: { save: (billing: BillingSettings) => Promise<LedgerData> }
  /** DATEV export of the invoices between two ISO dates. Returns the file path or null if cancelled. */
  datev: { export: (from: string, to: string) => Promise<{ path: string; bookings: number } | null> }
  /** Exports the document that is shown in the window as PDF. Returns the file path or null if cancelled. */
  pdf: { export: (suggestedName: string) => Promise<string | null> }
}

export const IPC = {
  appInfo: 'ledger:app-info',
  settingsGet: 'ledger:settings-get',
  settingsUpdate: 'ledger:settings-update',
  dataGet: 'ledger:data-get',
  companySave: 'ledger:company-save',
  customerSave: 'ledger:customer-save',
  customerRemove: 'ledger:customer-remove',
  documentCreate: 'ledger:document-create',
  documentUpdate: 'ledger:document-update',
  documentRemove: 'ledger:document-remove',
  documentIssue: 'ledger:document-issue',
  documentCancel: 'ledger:document-cancel',
  documentToInvoice: 'ledger:document-to-invoice',
  paymentAdd: 'ledger:payment-add',
  paymentRemove: 'ledger:payment-remove',
  reminderAdd: 'ledger:reminder-add',
  billingSave: 'ledger:billing-save',
  datevExport: 'ledger:datev-export',
  pdfExport: 'ledger:pdf-export'
} as const
