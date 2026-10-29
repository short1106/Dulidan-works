/** Brand colors, mirrored as CSS variables in tokens.css. */
export const colors = {
  primary: '#8122b5',
  accent: '#c020b8',
  accentLight: '#f5b8f2',
  backgroundDark: '#0b0614',
  surfaceDark: '#150b24',
  textOnDark: '#f3eaff'
} as const

export type ColorToken = keyof typeof colors
