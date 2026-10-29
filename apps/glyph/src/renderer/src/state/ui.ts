import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'

/** Which panels and dialogs are open. */
export interface UiState {
  settingsOpen: boolean
  findOpen: boolean
  /** Find panel opened with the replace field focused (Strg+H). */
  findWithReplace: boolean
  versionsOpen: boolean
  linkOpen: boolean
}

export const uiStore = createStore<UiState>({
  settingsOpen: false,
  findOpen: false,
  findWithReplace: false,
  versionsOpen: false,
  linkOpen: false
})

export function setUi(patch: Partial<UiState>): void {
  uiStore.set((state) => ({ ...state, ...patch }))
}

export function useUi(): UiState {
  return useSyncExternalStore(uiStore.subscribe, uiStore.get)
}
