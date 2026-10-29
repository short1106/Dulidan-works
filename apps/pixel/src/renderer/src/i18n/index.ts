import { de } from './de'

// Only German for now. Later this picks the language from the settings.
export const t = de

export const IS_MAC = navigator.userAgent.includes('Mac')

/** "Strg+S" on Windows and Linux, "⌘+S" on a Mac. */
export function shortcut(key: string, shift = false): string {
  return [IS_MAC ? '⌘' : 'Strg', shift ? 'Umschalt' : null, key].filter(Boolean).join('+')
}
