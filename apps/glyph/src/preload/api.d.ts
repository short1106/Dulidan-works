/** What the preload script exposes to the window as `window.glyph`. */
export interface GlyphApi {
  /** Operating system, e.g. 'win32', 'darwin' or 'linux'. */
  readonly platform: string
}

declare global {
  interface Window {
    glyph: GlyphApi
  }
}
