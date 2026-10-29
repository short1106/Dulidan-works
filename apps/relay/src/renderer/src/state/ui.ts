import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'

export type Area = 'mail' | 'calendar'

export interface UiState {
  area: Area
  settingsOpen: boolean
  /** Account dialog: null = closed, 'new' = add, otherwise the id to edit. */
  accountDialog: string | 'new' | null
}

export const uiStore = createStore<UiState>({ area: 'mail', settingsOpen: false, accountDialog: null })

export function setUi(patch: Partial<UiState>): void {
  uiStore.set((state) => ({ ...state, ...patch }))
}

export const useUi = (): UiState => useSyncExternalStore(uiStore.subscribe, uiStore.get)
