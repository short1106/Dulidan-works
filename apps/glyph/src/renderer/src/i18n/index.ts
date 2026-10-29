import { de } from './de'

// Only German for now. Later this picks the language from the settings.
export const t = de

/** "Strg" on Windows and Linux, "⌘" on a Mac. */
export const MOD_KEY_LABEL = navigator.userAgent.includes('Mac') ? '⌘' : 'Strg'

/** Builds a readable shortcut label, e.g. shortcut('S') -> "Strg+S". */
export function shortcut(key: string, shift = false): string {
  return [MOD_KEY_LABEL, shift ? 'Umschalt' : null, key].filter(Boolean).join('+')
}
