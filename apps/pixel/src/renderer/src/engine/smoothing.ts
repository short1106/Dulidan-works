import type { Point } from './geometry'

export interface StrokePoint extends Point {
  /** Pen pressure 0 to 1. Mouse and touch use 1. */
  pressure: number
}

/**
 * Soft line smoothing: the drawing point follows the pointer with a little
 * delay, which calms shaky hands and mouse jitter. `amount` 0 = off, 1 = strong.
 */
export class Smoother {
  private current: StrokePoint | null = null

  constructor(private readonly amount: number) {}

  push(point: StrokePoint): StrokePoint {
    if (!this.current) {
      this.current = { ...point }
      return { ...point }
    }
    const follow = 1 - Math.min(0.9, Math.max(0, this.amount) * 0.9)
    this.current = {
      x: this.current.x + (point.x - this.current.x) * follow,
      y: this.current.y + (point.y - this.current.y) * follow,
      pressure: this.current.pressure + (point.pressure - this.current.pressure) * follow
    }
    return { ...this.current }
  }
}

/**
 * Dab positions between two points, `spacing` pixels apart. Returns the
 * points after `from`, up to and including `to` when it is far enough away.
 * The leftover distance is carried over to the next segment.
 */
export function interpolateDabs(
  from: StrokePoint,
  to: StrokePoint,
  spacing: number,
  carry: number
): { dabs: StrokePoint[]; carry: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  const dabs: StrokePoint[] = []
  let distance = spacing - carry
  while (distance <= length) {
    const t = length === 0 ? 1 : distance / length
    dabs.push({ x: from.x + dx * t, y: from.y + dy * t, pressure: from.pressure + (to.pressure - from.pressure) * t })
    distance += spacing
  }
  return { dabs, carry: length - (distance - spacing) }
}
