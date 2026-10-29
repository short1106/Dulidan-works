/**
 * All German UI texts of Glyph live here, so English can be added later
 * as a second file with the same keys.
 */
export const de = {
  appName: 'Glyph',
  brand: 'Dulidan',
  welcomeTitle: 'Das Fundament steht',
  welcomeText: 'Hier entsteht deine Textverarbeitung. Der Editor kommt in einem der nächsten Schritte.'
} as const

export type Texts = typeof de
