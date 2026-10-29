import { beginPixelChange, context2d, type Layer } from './document'
import { clipRect, type Point } from './geometry'

export interface TextSettings {
  color: string
  /** Font size in canvas pixels. */
  size: number
  family: string
  bold: boolean
  opacity: number
}

export const LINE_HEIGHT = 1.25

export function fontString(settings: TextSettings): string {
  return `${settings.bold ? 700 : 400} ${settings.size}px ${settings.family}`
}

/** Draws text with line breaks onto the layer as one undo step. */
export function commitText(layer: Layer, position: Point, text: string, settings: TextSettings, label: string): void {
  const lines = text.replace(/\s+$/, '').split('\n')
  if (lines.every((line) => line.trim() === '')) return
  const context = context2d(layer.canvas)
  context.font = fontString(settings)
  const width = Math.max(...lines.map((line) => context.measureText(line).width))
  const height = lines.length * settings.size * LINE_HEIGHT
  const rect = clipRect(
    { x: position.x - 4, y: position.y - 4, width: width + 8 + settings.size * 0.5, height: height + 8 + settings.size * 0.3 },
    layer.canvas.width,
    layer.canvas.height
  )
  if (!rect) return
  const commit = beginPixelChange(layer, rect)
  context.save()
  context.font = fontString(settings)
  context.fillStyle = settings.color
  context.globalAlpha = settings.opacity
  context.textBaseline = 'top'
  lines.forEach((line, index) => context.fillText(line, position.x, position.y + index * settings.size * LINE_HEIGHT))
  context.restore()
  commit(label)
}
