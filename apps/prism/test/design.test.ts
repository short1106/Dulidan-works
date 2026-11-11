import { describe, expect, it } from 'vitest'
import { contrast, newDeck, type Deck, normalizeDeck, parseFile, serializeFile, SLIDE_COLORS, slideColors, THEMES, updateSlide, type ThemeId } from '../src/main/deck'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('Designs, Farben, Bilder, Übergänge', () => {
  it('alle Designs haben gut lesbare Schrift (WCAG AA)', () => {
    for (const theme of Object.values(THEMES)) expect(contrast(theme.background, theme.text)).toBeGreaterThanOrEqual(4.5)
  })

  it('wählt auf jeder Folienfarbe eine lesbare Schriftfarbe', () => {
    for (const theme of Object.keys(THEMES) as ThemeId[]) {
      for (const background of SLIDE_COLORS) {
        const colors = slideColors({ theme }, { background })
        expect(contrast(colors.background, colors.text)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(colors.background, colors.accent)).toBeGreaterThanOrEqual(3)
      }
    }
    expect(slideColors({ theme: 'papier' }, { background: null }).background).toBe(THEMES.papier.background)
  })

  it('speichert Design, Übergang, Folienfarbe und Bild und liest sie unverändert zurück', () => {
    let deck: Deck = { ...newDeck('Vortrag'), theme: 'ozean', transition: 'schieben' }
    deck = updateSlide(deck, 1, { background: '#c62828', image: { src: PNG, alt: 'Ein Foto', placement: 'gross' } })
    expect(parseFile(serializeFile(deck))).toEqual(deck)
  })

  it('öffnet alte Dateien (Version 1) ohne Design und Übergang', () => {
    const old = JSON.stringify({ format: 'prism-presentation', version: 1, deck: { title: 'Alt', slides: [{ id: 'a', layout: 'titel', title: 'Hallo', body: '' }] } })
    const deck = parseFile(old)
    expect(deck).toMatchObject({ title: 'Alt', theme: 'nacht', transition: 'keiner' })
    expect(deck.slides[0]).toMatchObject({ background: null, image: null })
  })

  it('verwirft kaputte Bilder und Farben, behält aber die Folie', () => {
    const deck = normalizeDeck({
      theme: 'gibtsnicht',
      slides: [{ id: 'a', layout: 'inhalt', title: 'X', body: '', background: 'rot', image: { src: 'https://fremd.example/bild.png', alt: 1 } }]
    })
    expect(deck.theme).toBe('nacht')
    expect(deck.slides[0]).toMatchObject({ title: 'X', background: null, image: null })
  })
})
