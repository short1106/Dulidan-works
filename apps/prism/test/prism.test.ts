import { describe, expect, it } from 'vitest'
import {
  addSlide,
  bodyLines,
  duplicateSlide,
  FORMAT,
  moveSlide,
  newDeck,
  normalizeDeck,
  parseFile,
  removeSlide,
  serializeFile,
  updateSlide
} from '../src/main/deck'

describe('Folien bearbeiten', () => {
  it('fügt eine Folie nach der aktuellen ein und am Ende', () => {
    const deck = newDeck()
    const after = addSlide(deck, 0, 'inhalt')
    expect(after.slides).toHaveLength(3)
    expect(after.slides[1].title).toBe('Neue Folie')
    expect(addSlide(deck, null).slides.at(-1)?.layout).toBe('inhalt')
  })

  it('löscht nie die letzte Folie', () => {
    const deck = { title: 'x', slides: [newDeck().slides[0]] }
    expect(removeSlide(deck, 0).slides).toHaveLength(1)
    expect(removeSlide(newDeck(), 0).slides).toHaveLength(1)
  })

  it('kopiert eine Folie mit neuer ID', () => {
    const deck = newDeck()
    const copy = duplicateSlide(deck, 0)
    expect(copy.slides).toHaveLength(3)
    expect(copy.slides[1].title).toBe(deck.slides[0].title)
    expect(copy.slides[1].id).not.toBe(deck.slides[0].id)
  })

  it('verschiebt Folien und lässt die Ränder in Ruhe', () => {
    const deck = newDeck()
    const moved = moveSlide(deck, 0, 1)
    expect(moved.slides[1].id).toBe(deck.slides[0].id)
    expect(moveSlide(deck, 0, -1)).toBe(deck)
  })

  it('ändert nur die gewählte Folie', () => {
    const before = newDeck()
    const deck = updateSlide(before, 1, { title: 'Neu' })
    expect(deck.slides[1].title).toBe('Neu')
    expect(deck.slides[0]).toEqual(before.slides[0])
  })

  it('macht aus "- " Aufzählungspunkte und lässt Leerzeilen weg', () => {
    expect(bodyLines('- eins\n\nzwei\n- drei')).toEqual([
      { text: 'eins', bullet: true },
      { text: 'zwei', bullet: false },
      { text: 'drei', bullet: true }
    ])
  })
})

describe('Dateiformat', () => {
  it('speichert und liest eine Präsentation unverändert zurück', () => {
    const deck = newDeck('Angebot')
    const text = serializeFile(deck)
    expect(JSON.parse(text).format).toBe(FORMAT)
    expect(parseFile(text)).toEqual(deck)
  })

  it('lehnt fremde Dateien ab', () => {
    expect(() => parseFile('{"format":"etwas-anderes","version":1}')).toThrow('keine Prism-Datei')
  })

  it('lehnt Dateien einer neueren Version ab', () => {
    expect(() => parseFile(JSON.stringify({ format: FORMAT, version: 99, deck: {} }))).toThrow('neuer')
  })

  it('repariert beschädigte Folien, ohne die ganze Präsentation zu verlieren', () => {
    const deck = normalizeDeck({ title: 5, slides: [{ id: 'a', layout: 'quatsch', title: 'Ok', body: 3 }, { nichts: true }] })
    expect(deck.title).toBe('Neue Präsentation')
    expect(deck.slides).toEqual([{ id: 'a', layout: 'inhalt', title: 'Ok', body: '' }])
  })

  it('bekommt eine Standardfolie, wenn gar keine Folie übrig ist', () => {
    expect(normalizeDeck({ slides: [] }).slides.length).toBeGreaterThan(0)
  })
})
