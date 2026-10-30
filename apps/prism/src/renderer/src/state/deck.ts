import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'
import { notify } from '@dulidan/design-system'
import { newDeck, type Deck } from '../../../main/deck'

export interface DeckState {
  deck: Deck
  /** Where the deck is saved, or null for a new, unsaved presentation. */
  path: string | null
  /** True when there are changes that are not in the file yet. */
  dirty: boolean
}

export const deckStore = createStore<DeckState>({ deck: newDeck(), path: null, dirty: false })

export function useDeckState(): DeckState {
  return useSyncExternalStore(deckStore.subscribe, deckStore.get)
}

/** Changes the deck (in memory). The crash backup follows a moment later. */
export function edit(change: (deck: Deck) => Deck): void {
  deckStore.set((state) => ({ ...state, deck: change(state.deck), dirty: true }))
  scheduleBackup()
}

export function replaceDeck(deck: Deck, path: string | null): void {
  deckStore.set({ deck, path, dirty: false })
}

let backupTimer: ReturnType<typeof setTimeout> | null = null

function scheduleBackup(): void {
  if (backupTimer) clearTimeout(backupTimer)
  backupTimer = setTimeout(() => {
    const { deck, dirty } = deckStore.get()
    if (dirty) void window.prism.recovery.save(deck).catch(() => undefined)
  }, 2000)
}

export async function saveDeck(saveAs = false): Promise<boolean> {
  const state = deckStore.get()
  try {
    const path = await window.prism.file.save(state.deck, saveAs ? null : state.path)
    if (!path) return false
    deckStore.set((current) => ({ ...current, path, dirty: false }))
    notify('Gespeichert.', 'success')
    return true
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Speichern hat nicht geklappt.', 'error')
    return false
  }
}

/** Opens a file. Asks first when there are unsaved changes, and returns false if the user cancels. */
export async function openDeck(confirmDiscard: () => Promise<boolean>): Promise<boolean> {
  if (deckStore.get().dirty && !(await confirmDiscard())) return false
  try {
    const opened = await window.prism.file.open()
    if (!opened) return false
    replaceDeck(opened.deck, opened.path)
    await window.prism.recovery.discard()
    return true
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Öffnen hat nicht geklappt.', 'error')
    return false
  }
}

/** Starts a new presentation. Same question as open when there are unsaved changes. */
export async function newPresentation(confirmDiscard: () => Promise<boolean>): Promise<boolean> {
  if (deckStore.get().dirty && !(await confirmDiscard())) return false
  replaceDeck(newDeck(), null)
  await window.prism.recovery.discard()
  return true
}
