import { useSyncExternalStore } from 'react'
import { createStore, DEFAULT_SETTINGS, type Mode, type Settings } from '@dulidan/core'
import { DEFAULT_PREFS, type CortexPrefs } from '../../../shared/ipc'

/** Settings (incl. the mode) and Cortex preferences. */
export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS)
export const prefsStore = createStore<CortexPrefs>(DEFAULT_PREFS)

export async function loadSettings(): Promise<Settings> {
  const [settings, prefs] = await Promise.all([window.cortex.settings.get(), window.cortex.prefs.get()])
  settingsStore.set(settings)
  prefsStore.set(prefs)
  return settings
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  settingsStore.set((current) => ({ ...current, ...patch }))
  settingsStore.set(await window.cortex.settings.update(patch))
}

export async function updatePrefs(patch: Partial<CortexPrefs>): Promise<void> {
  prefsStore.set((current) => ({ ...current, ...patch }))
  prefsStore.set(await window.cortex.prefs.update(patch))
}

export const useSettings = (): Settings => useSyncExternalStore(settingsStore.subscribe, settingsStore.get)
export const usePrefs = (): CortexPrefs => useSyncExternalStore(prefsStore.subscribe, prefsStore.get)
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
