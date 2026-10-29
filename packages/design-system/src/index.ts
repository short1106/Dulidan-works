/**
 * Dulidan design system.
 *
 * Step 1 only holds the brand colors. Fonts, themes and React components
 * (buttons, cards, ...) follow in step 2.
 */

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
