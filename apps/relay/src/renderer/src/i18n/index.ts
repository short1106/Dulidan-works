import { de } from './de'

export const t = de

export const IS_MAC = navigator.userAgent.includes('Mac')

export function shortcut(key: string, shift = false): string {
  return [IS_MAC ? '⌘' : 'Strg', shift ? 'Umschalt' : null, key].filter(Boolean).join('+')
}
