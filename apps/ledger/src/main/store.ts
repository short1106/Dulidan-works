import { randomUUID } from 'node:crypto'
import { JsonFile } from '@dulidan/core/node'
import { normalizeBilling, type BillingSettings } from './billing'
import { addDays, nextReminderLevel, REMINDER_DAYS, balanceOf, type Payment, type Reminder } from './payments'
import {
  companyProblems,
  documentProblems,
  nextNumber,
  SMALL_BUSINESS_NOTE,
  todayIso,
  type CompanyData,
  type Item
} from './logic'

export { DEFAULT_BILLING, normalizeBilling, type BillingSettings } from './billing'

export type DocumentKind = 'angebot' | 'rechnung'
export type DocumentStatus = 'entwurf' | 'ausgestellt' | 'storniert'

export interface Customer {
  id: string
  name: string
  street: string
  zip: string
  city: string
  email: string
}

/** What the document shows. Copied when it is issued, so later changes do not alter it. */
export interface Snapshot {
  company: CompanyData
  customer: Omit<Customer, 'id' | 'email'>
}

export interface Document {
  id: string
  kind: DocumentKind
  status: DocumentStatus
  /** Set when issued, e.g. RE-2026-0001. Never reused. */
  number: string | null
  date: string
  customerId: string | null
  items: Item[]
  note: string
  snapshot: Snapshot | null
  createdAt: number
  issuedAt: number | null
  cancelledAt: number | null
  /** Invoices: pay by this date (set when issued). Older invoices: date + payment term. */
  dueDate?: string | null
  /** Money received for an issued invoice. Never changes the invoice itself. */
  payments?: Payment[]
  /** Reminders sent for an overdue invoice. */
  reminders?: Reminder[]
}

export interface LedgerData {
  company: CompanyData
  customers: Customer[]
  documents: Document[]
  /** Last used number per kind and year, e.g. "RE-2026": 7. */
  counters: Record<string, number>
  billing: BillingSettings
}

export const EMPTY_COMPANY: CompanyData = {
  name: '',
  street: '',
  zip: '',
  city: '',
  taxNumber: '',
  vatId: '',
  email: '',
  phone: '',
  bank: '',
  iban: '',
  smallBusiness: false
}

const PREFIX: Record<DocumentKind, string> = { angebot: 'AN', rechnung: 'RE' }

export function normalizeData(raw: unknown): LedgerData {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<LedgerData>
  const company = { ...EMPTY_COMPANY, ...(typeof input.company === 'object' && input.company !== null ? input.company : {}) }
  return {
    company: { ...company, smallBusiness: company.smallBusiness === true },
    customers: Array.isArray(input.customers) ? input.customers.filter((item): item is Customer => typeof item?.id === 'string') : [],
    documents: Array.isArray(input.documents) ? input.documents.filter((item): item is Document => typeof item?.id === 'string') : [],
    counters: typeof input.counters === 'object' && input.counters !== null ? (input.counters as Record<string, number>) : {},
    billing: normalizeBilling(input.billing)
  }
}

export class DocumentError extends Error {}

/**
 * All data in one JSON file, written safely. Rules that keep the books clean:
 * - Only drafts can be changed or deleted.
 * - Issuing gives the next number and freezes the document.
 * - Issued documents are never deleted, only cancelled (the number stays used).
 */
export class LedgerStore {
  private readonly file: JsonFile<LedgerData>

  constructor(path: string) {
    this.file = new JsonFile<LedgerData>(path, normalizeData)
  }

  async load(): Promise<void> {
    await this.file.load()
  }

  data(): LedgerData {
    return this.file.get()
  }

  async saveCompany(company: CompanyData): Promise<void> {
    await this.file.update({ company })
  }

  async saveCustomer(input: Omit<Customer, 'id'> & { id?: string }): Promise<Customer> {
    const customers = this.data().customers
    if (input.id) {
      const updated = customers.map((item) => (item.id === input.id ? { ...item, ...input, id: item.id } : item))
      await this.file.update({ customers: updated })
      return updated.find((item) => item.id === input.id) as Customer
    }
    const customer: Customer = { ...input, id: randomUUID() }
    await this.file.update({ customers: [...customers, customer] })
    return customer
  }

  async removeCustomer(id: string): Promise<void> {
    const used = this.data().documents.some((doc) => doc.customerId === id && doc.status !== 'entwurf')
    if (used) throw new DocumentError('Dieser Kunde hat schon ausgestellte Dokumente. Er bleibt deshalb erhalten.')
    await this.file.update({ customers: this.data().customers.filter((item) => item.id !== id) })
  }

  async createDocument(kind: DocumentKind, customerId: string | null): Promise<Document> {
    const document: Document = {
      id: randomUUID(),
      kind,
      status: 'entwurf',
      number: null,
      date: todayIso(),
      customerId,
      items: [{ description: '', quantity: 1, unit: 'Stk', unitPriceCents: 0, vatRate: 19 }],
      note: '',
      snapshot: null,
      createdAt: Date.now(),
      issuedAt: null,
      cancelledAt: null
    }
    await this.file.update({ documents: [...this.data().documents, document] })
    return document
  }

  async updateDraft(id: string, patch: Partial<Pick<Document, 'customerId' | 'items' | 'note' | 'date'>>): Promise<Document> {
    const document = this.find(id)
    if (document.status !== 'entwurf') throw new DocumentError('Ausgestellte Dokumente können nicht geändert werden.')
    const updated = { ...document, ...patch }
    await this.replace(updated)
    return updated
  }

  async deleteDraft(id: string): Promise<void> {
    const document = this.find(id)
    if (document.status !== 'entwurf') throw new DocumentError('Ausgestellte Dokumente werden nicht gelöscht. Du kannst sie stornieren.')
    await this.file.update({ documents: this.data().documents.filter((item) => item.id !== id) })
  }

  /** Gives the number and freezes the document. Returns the issued document. */
  async issue(id: string, now: Date = new Date()): Promise<Document> {
    const document = this.find(id)
    if (document.status !== 'entwurf') throw new DocumentError('Dieses Dokument ist schon ausgestellt.')
    const company = this.data().company
    const missingCompany = companyProblems(company)
    if (missingCompany.length > 0) throw new DocumentError('Bitte erst in den Einstellungen eintragen: ' + missingCompany.join(', '))
    const customer = this.data().customers.find((item) => item.id === document.customerId)
    const problems = documentProblems({ customerName: customer?.name ?? null, items: document.items })
    if (problems.length > 0) throw new DocumentError('Noch nicht vollständig: ' + problems.join(', '))

    const year = now.getFullYear()
    const counter = nextNumber(PREFIX[document.kind], year, this.data().counters)
    const issued: Document = {
      ...document,
      status: 'ausgestellt',
      number: counter.number,
      date: todayIso(now),
      note: company.smallBusiness && document.kind === 'rechnung' ? [document.note, SMALL_BUSINESS_NOTE].filter(Boolean).join('\n') : document.note,
      snapshot: {
        company: { ...company },
        customer: { name: customer?.name ?? '', street: customer?.street ?? '', zip: customer?.zip ?? '', city: customer?.city ?? '' }
      },
      issuedAt: now.getTime(),
      dueDate: document.kind === 'rechnung' ? addDays(todayIso(now), this.data().billing.paymentTermDays) : null,
      payments: [],
      reminders: []
    }
    await this.file.update({
      documents: this.data().documents.map((item) => (item.id === id ? issued : item)),
      counters: { ...this.data().counters, [counter.key]: counter.value }
    })
    return issued
  }

  /** Cancels an issued document. It keeps its number and stays in the list. */
  async cancel(id: string, now: Date = new Date()): Promise<Document> {
    const document = this.find(id)
    if (document.status !== 'ausgestellt') throw new DocumentError('Nur ausgestellte Dokumente können storniert werden.')
    const cancelled: Document = { ...document, status: 'storniert', cancelledAt: now.getTime() }
    await this.replace(cancelled)
    return cancelled
  }

  async saveBilling(billing: BillingSettings): Promise<void> {
    await this.file.update({ billing: normalizeBilling(billing) })
  }

  private issuedInvoice(id: string): Document {
    const document = this.find(id)
    if (document.kind !== 'rechnung' || document.status !== 'ausgestellt') throw new DocumentError('Zahlungen gibt es nur bei ausgestellten Rechnungen.')
    return document
  }

  /** Records money received. The invoice itself stays unchanged. */
  async addPayment(id: string, payment: Omit<Payment, 'id'>): Promise<Document> {
    const document = this.issuedInvoice(id)
    if (!Number.isInteger(payment.amountCents) || payment.amountCents <= 0) throw new DocumentError('Bitte einen Betrag über 0 € eingeben.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.date)) throw new DocumentError('Bitte ein gültiges Datum eingeben.')
    const updated: Document = { ...document, payments: [...(document.payments ?? []), { ...payment, note: payment.note.trim(), id: randomUUID() }] }
    await this.replace(updated)
    return updated
  }

  /** Removes a payment that was entered by mistake. */
  async removePayment(id: string, paymentId: string): Promise<Document> {
    const document = this.issuedInvoice(id)
    const updated: Document = { ...document, payments: (document.payments ?? []).filter((payment) => payment.id !== paymentId) }
    await this.replace(updated)
    return updated
  }

  /** Writes down the next reminder (Zahlungserinnerung, 1. Mahnung, 2. Mahnung) with a new deadline. */
  async addReminder(id: string, now: Date = new Date()): Promise<Document> {
    const document = this.issuedInvoice(id)
    const today = todayIso(now)
    const billing = this.data().billing
    if (balanceOf(document, today, billing.paymentTermDays).state !== 'ueberfaellig') throw new DocumentError('Diese Rechnung ist nicht überfällig.')
    const level = nextReminderLevel(document.reminders)
    if (level === null) throw new DocumentError('Die letzte Mahnung wurde schon geschrieben. Bitte jetzt persönlich nachfassen.')
    const reminder: Reminder = { level, date: today, dueDate: addDays(today, REMINDER_DAYS), feeCents: level === 1 ? 0 : billing.reminderFeeCents }
    const updated: Document = { ...document, reminders: [...(document.reminders ?? []), reminder] }
    await this.replace(updated)
    return updated
  }

  /** Copies an offer into a new draft invoice. */
  async offerToInvoice(id: string): Promise<Document> {
    const offer = this.find(id)
    if (offer.kind !== 'angebot') throw new DocumentError('Nur Angebote können in eine Rechnung übernommen werden.')
    const draft = await this.createDocument('rechnung', offer.customerId)
    const updated: Document = { ...draft, items: offer.items.map((item) => ({ ...item })), note: offer.note }
    await this.replace(updated)
    return updated
  }

  find(id: string): Document {
    const document = this.data().documents.find((item) => item.id === id)
    if (!document) throw new DocumentError('Dokument nicht gefunden.')
    return document
  }

  private async replace(document: Document): Promise<void> {
    await this.file.update({ documents: this.data().documents.map((item) => (item.id === document.id ? document : item)) })
  }
}
