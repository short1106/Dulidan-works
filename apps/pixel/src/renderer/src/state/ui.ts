import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'

/** Which dialogs are open. */
export interface UiState {
  settingsOpen: boolean
  newOpen: boolean
  resizeOpen: boolean
}

export const uiStore = createStore<UiState>({ settingsOpen: false, newOpen: false, resizeOpen: false })

export function setUi(patch: Partial<UiState>): void {
  uiStore.set((state) => ({ ...state, ...patch }))
}

export function useUi(): UiState {
  return useSyncExternalStore(uiStore.subscribe, uiStore.get)
}
