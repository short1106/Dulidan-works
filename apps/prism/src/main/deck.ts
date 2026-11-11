/**
 * Prism's presentation model: slides with a title and text, plus the file
 * format (a JSON file with a version number). No files or windows here.
 */

export const FORMAT = 'prism-presentation'
/** Version 2 added designs, slide colors, pictures and transitions. Version 1 files still open. */
export const FORMAT_VERSION = 2

export type Layout = 'titel' | 'inhalt'

/** Where the picture of a slide goes: next to the text, or large below the title. */
export type ImagePlacement = 'rechts' | 'gross'

export interface SlideImage {
  /** The picture itself as a data URL, so the .prism file contains everything. */
  src: string
  /** Short description for screen readers. */
  alt: string
  placement: ImagePlacement
}

export interface Slide {
  id: string
  layout: Layout
  title: string
  /** Plain text. Each line becomes one bullet point; an empty line starts a new paragraph. */
  body: string
  /** Own background color of this slide, or null for the color of the design. */
  background: string | null
  image: SlideImage | null
}

export type TransitionId = 'keiner' | 'blende' | 'schieben'
export const TRANSITIONS: TransitionId[] = ['keiner', 'blende', 'schieben']

export interface Deck {
  title: string
  theme: ThemeId
  transition: TransitionId
  slides: Slide[]
}

export interface Theme {
  id: ThemeId
  background: string
  text: string
  accent: string
  /** Light designs get a dark border in the editor, dark ones the Dulidan magenta. */
  border: string
}

export type ThemeId = 'nacht' | 'hell' | 'papier' | 'ozean' | 'wald'

/** The designs. All text colors reach at least WCAG AA contrast on their background. */
export const THEMES: Record<ThemeId, Theme> = {
  nacht: { id: 'nacht', background: '#0b0614', text: '#f3eaff', accent: '#c020b8', border: '#c020b8' },
  hell: { id: 'hell', background: '#ffffff', text: '#1d0f2e', accent: '#8122b5', border: '#c9bfd6' },
  papier: { id: 'papier', background: '#f7f1e3', text: '#2b2118', accent: '#a0451c', border: '#d8ccb4' },
  ozean: { id: 'ozean', background: '#0b2440', text: '#eef6ff', accent: '#4fc3f7', border: '#4fc3f7' },
  wald: { id: 'wald', background: '#13281c', text: '#eef7ee', accent: '#8bd17c', border: '#8bd17c' }
}

/** Colors for a single slide. Text color is chosen automatically for good contrast. */
export const SLIDE_COLORS = ['#0b0614', '#ffffff', '#8122b5', '#c020b8', '#1f5fbf', '#2e7d32', '#d76a03', '#c62828'] as const

/** Kept for older code: the colors of the default design. */
export const COLORS = { background: THEMES.nacht.background, text: THEMES.nacht.text, accent: THEMES.nacht.accent } as const

function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contrast ratio of two colors (1 to 21). WCAG AA needs 4.5 for normal text. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** Background, text and accent of one slide: the design, or the slide's own color. */
export function slideColors(deck: Pick<Deck, 'theme'>, slide: Pick<Slide, 'background'>): { background: string; text: string; accent: string } {
  const theme = THEMES[deck.theme] ?? THEMES.nacht
  if (!slide.background) return { background: theme.background, text: theme.text, accent: theme.accent }
  const text = contrast(slide.background, '#ffffff') >= contrast(slide.background, '#111111') ? '#ffffff' : '#111111'
  // The accent must stay visible on the slide color; if not, it follows the text.
  const accent = contrast(slide.background, theme.accent) >= 3 ? theme.accent : text
  return { background: slide.background, text, accent }
}

let counter = 0
export function newId(): string {
  counter += 1
  return `s${Date.now().toString(36)}${counter.toString(36)}`
}

export function newSlide(layout: Layout = 'inhalt', title = '', body = ''): Slide {
  return { id: newId(), layout, title, body, background: null, image: null }
}

export function newDeck(title = 'Neue Präsentation'): Deck {
  return {
    title,
    theme: 'nacht',
    transition: 'blende',
    slides: [newSlide('titel', title, 'Untertitel'), newSlide('inhalt', 'Erste Folie', '- Punkt eins\n- Punkt zwei')]
  }
}

const HEX = /^#[0-9a-f]{6}$/i
const IMAGE_DATA = /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i

function normalizeImage(raw: unknown): SlideImage | null {
  const input = (typeof raw === 'object' && raw !== null ? raw : null) as Partial<SlideImage> | null
  if (!input || typeof input.src !== 'string' || !IMAGE_DATA.test(input.src)) return null
  return { src: input.src, alt: typeof input.alt === 'string' ? input.alt : '', placement: input.placement === 'gross' ? 'gross' : 'rechts' }
}

/** Keeps the deck valid, whatever was on disk. Damaged slides are dropped, never the whole deck. */
export function normalizeDeck(raw: unknown): Deck {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Deck>
  const theme: ThemeId = typeof input.theme === 'string' && input.theme in THEMES ? input.theme : 'nacht'
  const transition: TransitionId = TRANSITIONS.includes(input.transition as TransitionId) ? (input.transition as TransitionId) : 'keiner'
  const slides = Array.isArray(input.slides)
    ? input.slides
        .filter((slide): slide is Slide => typeof slide === 'object' && slide !== null && typeof (slide as Slide).id === 'string')
        .map((slide) => ({
          id: slide.id,
          layout: slide.layout === 'titel' ? ('titel' as const) : ('inhalt' as const),
          title: typeof slide.title === 'string' ? slide.title : '',
          body: typeof slide.body === 'string' ? slide.body : '',
          background: typeof slide.background === 'string' && HEX.test(slide.background) ? slide.background : null,
          image: normalizeImage(slide.image)
        }))
    : []
  return {
    title: typeof input.title === 'string' && input.title.trim() ? input.title : 'Neue Präsentation',
    theme,
    transition,
    slides: slides.length > 0 ? slides : newDeck().slides
  }
}

/** Reads a file in the Prism format. Throws if it is not a Prism file. */
export function parseFile(text: string): Deck {
  const parsed = JSON.parse(text) as { format?: unknown; version?: unknown; deck?: unknown }
  if (parsed.format !== FORMAT) throw new Error('Das ist keine Prism-Datei.')
  if (typeof parsed.version !== 'number' || parsed.version > FORMAT_VERSION) {
    throw new Error('Diese Datei ist neuer als diese Version von Prism. Bitte aktualisiere das Programm.')
  }
  return normalizeDeck(parsed.deck)
}

export function serializeFile(deck: Deck): string {
  return JSON.stringify({ format: FORMAT, version: FORMAT_VERSION, deck }, null, 2)
}

/** Returns a new deck with one slide added after `index` (or at the end). */
export function addSlide(deck: Deck, index: number | null, layout: Layout = 'inhalt'): Deck {
  const slide = newSlide(layout, layout === 'titel' ? 'Titel' : 'Neue Folie', '')
  const at = index === null ? deck.slides.length : index + 1
  return { ...deck, slides: [...deck.slides.slice(0, at), slide, ...deck.slides.slice(at)] }
}

/** A deck always keeps at least one slide. */
export function removeSlide(deck: Deck, index: number): Deck {
  if (deck.slides.length <= 1) return deck
  return { ...deck, slides: deck.slides.filter((_, i) => i !== index) }
}

export function duplicateSlide(deck: Deck, index: number): Deck {
  const original = deck.slides[index]
  if (!original) return deck
  const copy = { ...original, id: newId() }
  return { ...deck, slides: [...deck.slides.slice(0, index + 1), copy, ...deck.slides.slice(index + 1)] }
}

export function moveSlide(deck: Deck, index: number, direction: -1 | 1): Deck {
  const target = index + direction
  if (target < 0 || target >= deck.slides.length) return deck
  const slides = [...deck.slides]
  ;[slides[index], slides[target]] = [slides[target], slides[index]]
  return { ...deck, slides }
}

export function updateSlide(deck: Deck, index: number, patch: Partial<Omit<Slide, 'id'>>): Deck {
  return { ...deck, slides: deck.slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)) }
}

/** The body as list items for the slide. "- " starts a bullet point. */
export function bodyLines(body: string): Array<{ text: string; bullet: boolean }> {
  return body
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
    .map((line) => (line.startsWith('- ') ? { text: line.slice(2), bullet: true } : { text: line, bullet: false }))
}

/** Plain text of the deck, for the window title and checks. */
export function deckText(deck: Deck): string {
  return deck.slides.map((slide) => `${slide.title}\n${slide.body}`).join('\n')
}
