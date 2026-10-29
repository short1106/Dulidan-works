import { useSyncExternalStore } from 'react'
import { createStore, DEFAULT_SETTINGS, type Mode, type Settings } from '@dulidan/core'
import type { AccountSettings, RelayPrefs } from '../../../shared/ipc'

/** Settings (incl. the mode), Relay preferences and the account list. */
export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS)
export const prefsStore = createStore<RelayPrefs>({ pollMinutes: 5, notifications: true })
export const accountsStore = createStore<AccountSettings[]>([])

export async function loadSettings(): Promise<Settings> {
  const [settings, prefs, accounts] = await Promise.all([window.relay.settings.get(), window.relay.prefs.get(), window.relay.accounts.list()])
  settingsStore.set(settings)
  prefsStore.set(prefs)
  accountsStore.set(accounts)
  return settings
}

export async function reloadAccounts(): Promise<void> {
  accountsStore.set(await window.relay.accounts.list())
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  settingsStore.set((current) => ({ ...current, ...patch }))
  settingsStore.set(await window.relay.settings.update(patch))
}

export async function updatePrefs(patch: Partial<RelayPrefs>): Promise<void> {
  prefsStore.set((current) => ({ ...current, ...patch }))
  prefsStore.set(await window.relay.prefs.update(patch))
}

export const useSettings = (): Settings => useSyncExternalStore(settingsStore.subscribe, settingsStore.get)
export const usePrefs = (): RelayPrefs => useSyncExternalStore(prefsStore.subscribe, prefsStore.get)
export const useAccounts = (): AccountSettings[] => useSyncExternalStore(accountsStore.subscribe, accountsStore.get)
export const useMode = (): Mode => useSettings().mode ?? 'basic'
export const currentMode = (): Mode => settingsStore.get().mode ?? 'basic'

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function applySettingsToDocument(settings: Settings): void {
  const root = document.documentElement
  root.dataset['theme'] = settings.theme
  root.dataset['mode'] = settings.mode ?? 'basic'
  root.dataset['motion'] = !settings.animations || settings.mode === 'basic' ? 'reduced' : 'full'
  root.style.setProperty('--dd-basic-scale', String(settings.basicFontScale))
}
