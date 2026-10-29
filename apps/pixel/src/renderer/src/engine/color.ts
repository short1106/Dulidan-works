/** Color in hue (0-360), saturation (0-1) and brightness (0-1). */
export interface Hsv {
  h: number
  s: number
  v: number
}

export interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb {
  const value = parseInt(normalizeHex(hex)?.slice(1) ?? '000000', 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number): string => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** Accepts "#abc", "abc", "#aabbcc" or "aabbcc". Returns "#aabbcc" or null. */
export function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(value)) return `#${value.split('').map((c) => c + c).join('')}`
  if (/^[0-9a-f]{6}$/.test(value)) return `#${value}`
  return null
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

export const hexToHsv = (hex: string): Hsv => rgbToHsv(hexToRgb(hex))
export const hsvToHex = (hsv: Hsv): string => rgbToHex(hsvToRgb(hsv))

/** Puts a color at the front of the recent list, without duplicates. */
export function addRecentColor(list: readonly string[], color: string, max = 12): string[] {
  const hex = normalizeHex(color)
  if (!hex) return [...list]
  return [hex, ...list.filter((item) => item !== hex)].slice(0, max)
}
