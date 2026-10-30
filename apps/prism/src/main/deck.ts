/**
 * Prism's presentation model: slides with a title and text, plus the file
 * format (a JSON file with a version number). No files or windows here.
 */

export const FORMAT = 'prism-presentation'
export const FORMAT_VERSION = 1

export type Layout = 'titel' | 'inhalt'

export interface Slide {
  id: string
  layout: Layout
  title: string
  /** Plain text. Each line becomes one bullet point; an empty line starts a new paragraph. */
  body: string
}

export interface Deck {
  title: string
  slides: Slide[]
}

export const COLORS = {
  background: '#0b0614',
  text: '#f3eaff',
  accent: '#c020b8'
} as const

let counter = 0
export function newId(): string {
  counter += 1
  return `s${Date.now().toString(36)}${counter.toString(36)}`
}

export function newSlide(layout: Layout = 'inhalt', title = '', body = ''): Slide {
  return { id: newId(), layout, title, body }
}

export function newDeck(title = 'Neue Präsentation'): Deck {
  return { title, slides: [newSlide('titel', title, 'Untertitel'), newSlide('inhalt', 'Erste Folie', '- Punkt eins\n- Punkt zwei')] }
}

/** Keeps the deck valid, whatever was on disk. Damaged slides are dropped, never the whole deck. */
export function normalizeDeck(raw: unknown): Deck {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Deck>
  const slides = Array.isArray(input.slides)
    ? input.slides
        .filter((slide): slide is Slide => typeof slide === 'object' && slide !== null && typeof (slide as Slide).id === 'string')
        .map((slide) => ({
          id: slide.id,
          layout: slide.layout === 'titel' ? ('titel' as const) : ('inhalt' as const),
          title: typeof slide.title === 'string' ? slide.title : '',
          body: typeof slide.body === 'string' ? slide.body : ''
        }))
    : []
  return { title: typeof input.title === 'string' && input.title.trim() ? input.title : 'Neue Präsentation', slides: slides.length > 0 ? slides : newDeck().slides }
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
