import { useSyncExternalStore } from 'react'
import { createStore, DEFAULT_SETTINGS, type Mode, type Settings } from '@dulidan/core'

/**
 * The central app state for settings, including the current mode.
 * The main process stores them on disk; this store mirrors them in the window.
 */
export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS)

export async function loadSettings(): Promise<Settings> {
  const settings = await window.glyph.settings.get()
  settingsStore.set(settings)
  window.glyph.settings.onChange((next) => settingsStore.set(next))
  return settings
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  // Show the change at once, then store it.
  settingsStore.set((current) => ({ ...current, ...patch }))
  settingsStore.set(await window.glyph.settings.update(patch))
}

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get)
}

/** The current mode. Falls back to basic before the first choice. */
export function useMode(): Mode {
  return useSettings().mode ?? 'basic'
}

/** True when the user or the system wants as little motion as possible. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Applies theme, mode and motion to <html> so the CSS of the design system
 * can react. Basic mode always has strongly reduced motion.
 */
export function applySettingsToDocument(settings: Settings): void {
  const root = document.documentElement
  const mode = settings.mode ?? 'basic'
  root.dataset['theme'] = settings.theme
  root.dataset['mode'] = mode
  root.dataset['motion'] = !settings.animations || settings.mode === 'basic' ? 'reduced' : 'full'
  root.style.setProperty('--dd-basic-scale', String(settings.basicFontScale))
}
