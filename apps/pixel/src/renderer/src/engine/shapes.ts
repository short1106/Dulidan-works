import { beginPixelChange, context2d, type Layer } from './document'
import { clipRect, type Point, type Rect } from './geometry'

export type ShapeKind = 'line' | 'rectangle' | 'ellipse'

export interface ShapeSettings {
  kind: ShapeKind
  color: string
  /** Line width in pixels. */
  width: number
  opacity: number
  /** Fill rectangles and ellipses instead of only drawing the outline. */
  filled: boolean
}

/** Draws a shape from `start` to `end` onto a 2D context. */
export function drawShape(context: CanvasRenderingContext2D, start: Point, end: Point, settings: ShapeSettings): void {
  context.save()
  context.globalAlpha = settings.opacity
  context.strokeStyle = settings.color
  context.fillStyle = settings.color
  context.lineWidth = settings.width
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  if (settings.kind === 'line') {
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
    context.stroke()
  } else {
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const w = Math.abs(end.x - start.x)
    const h = Math.abs(end.y - start.y)
    if (settings.kind === 'rectangle') context.rect(x, y, w, h)
    else context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    if (settings.filled) context.fill()
    else context.stroke()
  }
  context.restore()
}

/** Area a shape can touch, including half the line width. */
export function shapeBounds(start: Point, end: Point, lineWidth: number): Rect {
  const pad = lineWidth / 2 + 2
  return {
    x: Math.min(start.x, end.x) - pad,
    y: Math.min(start.y, end.y) - pad,
    width: Math.abs(end.x - start.x) + pad * 2,
    height: Math.abs(end.y - start.y) + pad * 2
  }
}

/** Draws the finished shape onto the layer as one undo step. */
export function commitShape(layer: Layer, start: Point, end: Point, settings: ShapeSettings, label: string): void {
  const rect = clipRect(shapeBounds(start, end, settings.width), layer.canvas.width, layer.canvas.height)
  if (!rect) return
  const commit = beginPixelChange(layer, rect)
  drawShape(context2d(layer.canvas), start, end, settings)
  commit(label)
}
