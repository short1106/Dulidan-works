import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'

export interface UiState {
  settingsOpen: boolean
  /** Dialog for a new folder (inside "parent") or for renaming "path". */
  folderDialog: { kind: 'new'; parent: string } | { kind: 'rename'; path: string } | null
  moveDialog: boolean
  /** HTML for the PDF (only visible when printing). */
  printHtml: { title: string; html: string } | null
}

export const uiStore = createStore<UiState>({ settingsOpen: false, folderDialog: null, moveDialog: false, printHtml: null })
export const useUi = (): UiState => useSyncExternalStore(uiStore.subscribe, uiStore.get)

export function setUi(patch: Partial<UiState>): void {
  uiStore.set((state) => ({ ...state, ...patch }))
}

/** Puts the cursor into the search field (Strg+F). */
export function focusSearch(): void {
  document.querySelector<HTMLInputElement>('.search-field__input')?.focus()
}
