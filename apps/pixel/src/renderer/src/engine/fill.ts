import { hexToRgb } from './color'
import { beginPixelChange, context2d, createCanvas, type Layer } from './document'
import { floodFillMask, growMask } from './floodFill'

/** Paint bucket on one layer. Returns false if nothing was filled. */
export function fillAt(layer: Layer, x: number, y: number, color: string, tolerance: number, opacity: number, label: string): boolean {
  const { width, height } = layer.canvas
  const context = context2d(layer.canvas)
  const data = context.getImageData(0, 0, width, height).data
  const found = floodFillMask(data, width, height, x, y, tolerance)
  if (!found) return false
  // Cover the soft edges of lines when some tolerance is allowed.
  const { mask, bounds } = tolerance > 0 ? growMask(found, width, height) : found

  const paint = new ImageData(bounds.width, bounds.height)
  const { r, g, b } = hexToRgb(color)
  for (let row = 0; row < bounds.height; row++) {
    for (let col = 0; col < bounds.width; col++) {
      if (!mask[(bounds.y + row) * width + bounds.x + col]) continue
      paint.data.set([r, g, b, 255], (row * bounds.width + col) * 4)
    }
  }
  const stamp = createCanvas(bounds.width, bounds.height)
  context2d(stamp).putImageData(paint, 0, 0)

  const commit = beginPixelChange(layer, bounds)
  context.save()
  context.globalAlpha = opacity
  context.drawImage(stamp, bounds.x, bounds.y)
  context.restore()
  commit(label)
  return true
}
