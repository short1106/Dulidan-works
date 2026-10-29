import type { Rect } from './geometry'

export interface FillMask {
  /** 1 for every pixel to fill, size width * height. */
  mask: Uint8Array
  bounds: Rect
}

/**
 * Paint bucket: finds all connected pixels with (almost) the same color as
 * the start pixel. `tolerance` 0 to 255 is the allowed difference per color
 * channel. Works line by line, so big areas do not overflow the stack.
 */
export function floodFillMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  tolerance: number
): FillMask | null {
  const sx = Math.floor(startX)
  const sy = Math.floor(startY)
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null

  const start = (sy * width + sx) * 4
  const target = [data[start]!, data[start + 1]!, data[start + 2]!, data[start + 3]!]
  const mask = new Uint8Array(width * height)

  const matches = (pixel: number): boolean => {
    if (mask[pixel]) return false
    const i = pixel * 4
    // Fully transparent pixels count as equal, whatever color they "have".
    if (target[3] === 0 && data[i + 3] === 0) return true
    return (
      Math.abs(data[i]! - target[0]!) <= tolerance &&
      Math.abs(data[i + 1]! - target[1]!) <= tolerance &&
      Math.abs(data[i + 2]! - target[2]!) <= tolerance &&
      Math.abs(data[i + 3]! - target[3]!) <= tolerance
    )
  }

  let minX = sx
  let maxX = sx
  let minY = sy
  let maxY = sy
  const stack: number[] = [sx, sy]
  while (stack.length > 0) {
    const y = stack.pop()!
    let x = stack.pop()!
    // Walk left to the start of the run, then fill to the right.
    while (x > 0 && matches(y * width + x - 1)) x--
    let spanAbove = false
    let spanBelow = false
    for (; x < width && matches(y * width + x); x++) {
      mask[y * width + x] = 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (y > 0) {
        const above = matches((y - 1) * width + x)
        if (above && !spanAbove) stack.push(x, y - 1)
        spanAbove = above
      }
      if (y < height - 1) {
        const below = matches((y + 1) * width + x)
        if (below && !spanBelow) stack.push(x, y + 1)
        spanBelow = below
      }
    }
  }
  return { mask, bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } }
}

/**
 * Grows the mask by one pixel, so the soft edges of brush strokes get
 * covered and no light seam stays between line and fill.
 */
export function growMask(fill: FillMask, width: number, height: number): FillMask {
  const { mask, bounds } = fill
  const grown = mask.slice()
  const x0 = Math.max(0, bounds.x - 1)
  const y0 = Math.max(0, bounds.y - 1)
  const x1 = Math.min(width - 1, bounds.x + bounds.width)
  const y1 = Math.min(height - 1, bounds.y + bounds.height)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * width + x
      if (mask[i]) continue
      if ((x > 0 && mask[i - 1]) || (x < width - 1 && mask[i + 1]) || (y > 0 && mask[i - width]) || (y < height - 1 && mask[i + width])) {
        grown[i] = 1
      }
    }
  }
  return { mask: grown, bounds: { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } }
}
