import { describe, expect, it } from 'vitest'
import { addRecentFile, DEFAULT_SETTINGS, normalizeSettings } from '../src/settings'

describe('settings', () => {
  it('falls back to defaults for empty or broken input', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('garbage')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ mode: 'chef', theme: 42, zoom: 'big' })).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid values', () => {
    const settings = normalizeSettings({ mode: 'expert', theme: 'light', animations: false, basicFontScale: 1.3, zoom: 150 })
    expect(settings).toMatchObject({ mode: 'expert', theme: 'light', animations: false, basicFontScale: 1.3, zoom: 150 })
  })

  it('clamps zoom', () => {
    expect(normalizeSettings({ zoom: 1000 }).zoom).toBe(200)
    expect(normalizeSettings({ zoom: 1 }).zoom).toBe(50)
  })

  it('keeps the recent list unique and short', () => {
    let list: string[] = []
    for (let i = 0; i < 12; i++) list = addRecentFile(list, `/docs/${i}.glyph`)
    list = addRecentFile(list, '/docs/5.glyph')
    expect(list).toHaveLength(10)
    expect(list[0]).toBe('/docs/5.glyph')
    expect(new Set(list).size).toBe(10)
  })
})
