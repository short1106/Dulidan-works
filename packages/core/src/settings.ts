import { isMode, type Mode } from './mode'

export type Theme = 'dark' | 'light'

/** Font size steps for basic mode: normal, large, very large. */
export const BASIC_FONT_SCALES = [1, 1.15, 1.3] as const
export type BasicFontScale = (typeof BASIC_FONT_SCALES)[number]

export const MAX_RECENT_FILES = 10

/** User settings, stored as JSON on the user's computer. */
export interface Settings {
  settingsVersion: 1
  /** null until the user picked a mode on the first start. */
  mode: Mode | null
  theme: Theme
  /** Small animations in daily use (hover glow, save check mark). */
  animations: boolean
  basicFontScale: BasicFontScale
  /** Most recently opened files, newest first. */
  recentFiles: string[]
  /** Document zoom in percent. */
  zoom: number
}

export const DEFAULT_SETTINGS: Settings = {
  settingsVersion: 1,
  mode: null,
  theme: 'dark',
  animations: true,
  basicFontScale: 1,
  recentFiles: [],
  zoom: 100
}

export const ZOOM_MIN = 50
export const ZOOM_MAX = 200

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_SETTINGS.zoom
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom)))
}

/**
 * Turns whatever was read from disk into valid settings. Unknown or broken
 * values fall back to the defaults, so a damaged file never blocks the app.
 */
export function normalizeSettings(raw: unknown): Settings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const scale = BASIC_FONT_SCALES.find((value) => value === input['basicFontScale'])
  const recent = Array.isArray(input['recentFiles'])
    ? input['recentFiles'].filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
  return {
    settingsVersion: 1,
    mode: isMode(input['mode']) ? input['mode'] : null,
    theme: input['theme'] === 'light' ? 'light' : 'dark',
    animations: typeof input['animations'] === 'boolean' ? input['animations'] : DEFAULT_SETTINGS.animations,
    basicFontScale: scale ?? DEFAULT_SETTINGS.basicFontScale,
    recentFiles: [...new Set(recent)].slice(0, MAX_RECENT_FILES),
    zoom: typeof input['zoom'] === 'number' ? clampZoom(input['zoom']) : DEFAULT_SETTINGS.zoom
  }
}

/** Puts a file at the top of the recent list, without duplicates. */
export function addRecentFile(list: readonly string[], path: string, max = MAX_RECENT_FILES): string[] {
  return [path, ...list.filter((item) => item !== path)].slice(0, max)
}
