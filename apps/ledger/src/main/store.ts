import { randomUUID } from 'node:crypto'
import { JsonFile } from '@dulidan/core/node'
import {
  companyProblems,
  documentProblems,
  nextNumber,
  SMALL_BUSINESS_NOTE,
  todayIso,
  type CompanyData,
  type Item
} from './logic'

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
}

export interface LedgerData {
  company: CompanyData
  customers: Customer[]
  documents: Document[]
  /** Last used number per kind and year, e.g. "RE-2026": 7. */
  counters: Record<string, number>
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
    counters: typeof input.counters === 'object' && input.counters !== null ? (input.counters as Record<string, number>) : {}
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
      issuedAt: now.getTime()
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
