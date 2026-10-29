import { useSyncExternalStore } from 'react'
import { createStore, DEFAULT_SETTINGS, type Settings } from '@dulidan/core'

/** Shared settings (mode, theme, animations) for all Dulidan apps. */
export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS)

export async function loadSettings(): Promise<Settings> {
  const settings = await window.radar.settings.get()
  settingsStore.set(settings)
  applySettingsToDocument(settings)
  return settings
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  settingsStore.set((current) => ({ ...current, ...patch }))
  const saved = await window.radar.settings.update(patch)
  settingsStore.set(saved)
  applySettingsToDocument(saved)
}

/** Theme and mode go to <html>, so the CSS of the design system and of Radar can react. */
export function applySettingsToDocument(settings: Settings): void {
  const root = document.documentElement
  root.dataset['theme'] = settings.theme
  root.dataset['mode'] = settings.mode ?? 'expert'
  root.dataset['motion'] = settings.animations ? 'on' : 'off'
}

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get)
}
