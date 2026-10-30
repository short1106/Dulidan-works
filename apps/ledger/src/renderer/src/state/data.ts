import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'
import { notify } from '@dulidan/design-system'
import type { LedgerData } from '../../../shared/api'

/** Companies, customers and documents as the main process has them. */
export const dataStore = createStore<LedgerData>({ company: { name: '', street: '', zip: '', city: '', taxNumber: '', vatId: '', email: '', phone: '', bank: '', iban: '', smallBusiness: false }, customers: [], documents: [] })

export async function loadData(): Promise<void> {
  dataStore.set(await window.ledger.data.get())
}

/** Runs an action that returns the new data. Errors are shown as a notice in plain German. */
export async function change(action: () => Promise<LedgerData>): Promise<LedgerData | null> {
  try {
    const next = await action()
    dataStore.set(next)
    return next
  } catch (error) {
    notify(cleanMessage(error), 'error')
    return null
  }
}

/** Electron adds "Error invoking remote method ..." in front of the message. Remove it. */
export function cleanMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** The current data; components re-render when it changes. */
export function useData(): LedgerData {
  return useSyncExternalStore(dataStore.subscribe, dataStore.get)
}
