import { useSyncExternalStore } from 'react'
import { createStore, DEFAULT_SETTINGS, type Mode, type Settings } from '@dulidan/core'
import { addRecentColor } from '../engine/color'
import { MAX_RECENT_COLORS, type PixelPrefs } from '../../../shared/ipc'

/** Settings (incl. the mode) mirrored from the main process. */
export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS)
export const prefsStore = createStore<PixelPrefs>({ recentColors: [] })

export async function loadSettings(): Promise<Settings> {
  const [settings, prefs] = await Promise.all([window.pixel.settings.get(), window.pixel.prefs.get()])
  settingsStore.set(settings)
  prefsStore.set(prefs)
  return settings
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  settingsStore.set((current) => ({ ...current, ...patch }))
  settingsStore.set(await window.pixel.settings.update(patch))
}

let prefsTimer = 0
/** Remembers a used color. Writing to disk is delayed a little. */
export function rememberColor(color: string): void {
  prefsStore.set((prefs) => ({ ...prefs, recentColors: addRecentColor(prefs.recentColors, color, MAX_RECENT_COLORS) }))
  clearTimeout(prefsTimer)
  prefsTimer = window.setTimeout(() => void window.pixel.prefs.update(prefsStore.get()), 800)
}

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get)
}

export function usePrefs(): PixelPrefs {
  return useSyncExternalStore(prefsStore.subscribe, prefsStore.get)
}

export function useMode(): Mode {
  return useSettings().mode ?? 'basic'
}

export function currentMode(): Mode {
  return settingsStore.get().mode ?? 'basic'
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Theme, mode and motion on <html>, so the design system CSS can react. */
export function applySettingsToDocument(settings: Settings): void {
  const root = document.documentElement
  root.dataset['theme'] = settings.theme
  root.dataset['mode'] = settings.mode ?? 'basic'
  root.dataset['motion'] = !settings.animations || settings.mode === 'basic' ? 'reduced' : 'full'
  root.style.setProperty('--dd-basic-scale', String(settings.basicFontScale))
}
