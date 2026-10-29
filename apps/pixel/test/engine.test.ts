import { describe, expect, it } from 'vitest'
import { addRecentColor, hexToHsv, hsvToHex, normalizeHex } from '../src/renderer/src/engine/color'
import { floodFillMask, growMask } from '../src/renderer/src/engine/floodFill'
import { clipRect, constrainPoint, unionRect } from '../src/renderer/src/engine/geometry'
import { interpolateDabs, Smoother } from '../src/renderer/src/engine/smoothing'

/** Builds RGBA pixels from rows of characters: '#' black, '.' white. */
function image(rows: string[]): { data: Uint8ClampedArray; width: number; height: number } {
  const width = rows[0]!.length
  const height = rows.length
  const data = new Uint8ClampedArray(width * height * 4)
  rows.forEach((row, y) =>
    row.split('').forEach((cell, x) => {
      const value = cell === '#' ? 0 : 255
      data.set([value, value, value, 255], (y * width + x) * 4)
    })
  )
  return { data, width, height }
}

describe('flood fill', () => {
  it('fills only the connected area', () => {
    const { data, width, height } = image(['.....', '.###.', '.#.#.', '.###.', '.....'])
    const inside = floodFillMask(data, width, height, 2, 2, 0)!
    expect(Array.from(inside.mask).filter(Boolean)).toHaveLength(1)
    expect(inside.bounds).toEqual({ x: 2, y: 2, width: 1, height: 1 })

    const outside = floodFillMask(data, width, height, 0, 0, 0)!
    expect(Array.from(outside.mask).filter(Boolean)).toHaveLength(16)
  })

  it('respects the tolerance', () => {
    const { data, width, height } = image(['..', '..'])
    data.set([240, 240, 240, 255], 4) // second pixel slightly darker
    expect(Array.from(floodFillMask(data, width, height, 0, 0, 0)!.mask).filter(Boolean)).toHaveLength(3)
    expect(Array.from(floodFillMask(data, width, height, 0, 0, 20)!.mask).filter(Boolean)).toHaveLength(4)
  })

  it('handles big areas without running out of stack', () => {
    const size = 1500
    const data = new Uint8ClampedArray(size * size * 4)
    const fill = floodFillMask(data, size, size, 10, 10, 0)!
    expect(fill.bounds).toEqual({ x: 0, y: 0, width: size, height: size })
  })

  it('ignores clicks outside and grows the edge by one pixel', () => {
    const { data, width, height } = image(['.....', '.###.', '.#.#.', '.###.', '.....'])
    expect(floodFillMask(data, width, height, -1, 0, 0)).toBeNull()
    const grown = growMask(floodFillMask(data, width, height, 2, 2, 0)!, width, height)
    expect(Array.from(grown.mask).filter(Boolean)).toHaveLength(5)
  })
})

describe('colors', () => {
  it('converts between hex and HSV', () => {
    for (const hex of ['#8122b5', '#c020b8', '#ffffff', '#000000', '#12ab34']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex)
    }
  })

  it('normalizes typed hex codes', () => {
    expect(normalizeHex('ABC')).toBe('#aabbcc')
    expect(normalizeHex('#8122B5')).toBe('#8122b5')
    expect(normalizeHex('lila')).toBeNull()
  })

  it('keeps recent colors unique and short', () => {
    let list: string[] = []
    for (let i = 0; i < 15; i++) list = addRecentColor(list, `#0000${i.toString(16).padStart(2, '0')}`)
    list = addRecentColor(list, '#000005')
    expect(list).toHaveLength(12)
    expect(list[0]).toBe('#000005')
  })
})

describe('geometry', () => {
  it('joins and clips rectangles', () => {
    expect(unionRect(null, { x: 1, y: 1, width: 2, height: 2 })).toEqual({ x: 1, y: 1, width: 2, height: 2 })
    expect(unionRect({ x: 0, y: 0, width: 1, height: 1 }, { x: 5, y: 5, width: 1, height: 1 })).toEqual({ x: 0, y: 0, width: 6, height: 6 })
    expect(clipRect({ x: -5.5, y: 2.2, width: 10, height: 100 }, 50, 50)).toEqual({ x: 0, y: 2, width: 5, height: 48 })
    expect(clipRect({ x: 60, y: 0, width: 5, height: 5 }, 50, 50)).toBeNull()
  })

  it('snaps lines to 45 degrees and boxes to squares', () => {
    const line = constrainPoint({ x: 0, y: 0 }, { x: 10, y: 1 }, 'line')
    expect(line.y).toBeCloseTo(0)
    const box = constrainPoint({ x: 0, y: 0 }, { x: 10, y: -4 }, 'box')
    expect(box).toEqual({ x: 10, y: -10 })
  })
})

describe('stroke smoothing', () => {
  it('places dabs evenly and carries the rest over', () => {
    const a = { x: 0, y: 0, pressure: 1 }
    const first = interpolateDabs(a, { x: 10, y: 0, pressure: 1 }, 4, 0)
    expect(first.dabs.map((d) => d.x)).toEqual([4, 8])
    expect(first.carry).toBeCloseTo(2)
    const second = interpolateDabs({ x: 10, y: 0, pressure: 1 }, { x: 13, y: 0, pressure: 1 }, 4, first.carry)
    expect(second.dabs.map((d) => d.x)).toEqual([12])
  })

  it('smooths jitter but follows the hand', () => {
    const smoother = new Smoother(0.5)
    smoother.push({ x: 0, y: 0, pressure: 1 })
    const next = smoother.push({ x: 10, y: 0, pressure: 1 })
    expect(next.x).toBeGreaterThan(0)
    expect(next.x).toBeLessThan(10)
    const off = new Smoother(0)
    off.push({ x: 0, y: 0, pressure: 1 })
    expect(off.push({ x: 10, y: 0, pressure: 1 }).x).toBe(10)
  })
})
