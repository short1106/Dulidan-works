/** A rectangle in canvas pixels. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** Smallest rectangle containing both (null counts as empty). */
export function unionRect(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b }
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  }
}

/** Rounds outward to whole pixels and cuts to the canvas. Null if nothing is left. */
export function clipRect(rect: Rect, width: number, height: number): Rect | null {
  const x = Math.max(0, Math.floor(rect.x))
  const y = Math.max(0, Math.floor(rect.y))
  const right = Math.min(width, Math.ceil(rect.x + rect.width))
  const bottom = Math.min(height, Math.ceil(rect.y + rect.height))
  if (right <= x || bottom <= y) return null
  return { x, y, width: right - x, height: bottom - y }
}

/** Rectangle spanned by two corner points, in any drag direction. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}

/**
 * With Shift held: squares and circles stay even, lines snap to steps of
 * 45 degrees.
 */
export function constrainPoint(start: Point, end: Point, kind: 'line' | 'box'): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (kind === 'box') {
    const side = Math.max(Math.abs(dx), Math.abs(dy))
    return { x: start.x + Math.sign(dx || 1) * side, y: start.y + Math.sign(dy || 1) * side }
  }
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  const length = Math.hypot(dx, dy)
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length }
}
