import { hexToRgb } from './color'
import { context2d, createCanvas, getDoc, pixelStep, record, touch, type Layer } from './document'
import { clipRect, unionRect, type Rect } from './geometry'
import { interpolateDabs, Smoother, type StrokePoint } from './smoothing'

export interface BrushSettings {
  color: string
  /** Diameter in pixels. */
  size: number
  /** 0 = very soft edge, 1 = hard edge. */
  hardness: number
  /** 0 to 1, for the whole stroke. */
  opacity: number
  /** 0 = off, 1 = strong line smoothing. */
  smoothing: number
  /** Eraser instead of paint. */
  erase: boolean
}

/** Round brush tip, drawn once per settings and reused for every dab. */
const tipCache = new Map<string, HTMLCanvasElement>()

function brushTip(color: string, hardness: number): HTMLCanvasElement {
  const key = `${color}|${hardness.toFixed(2)}`
  const cached = tipCache.get(key)
  if (cached) return cached
  const size = 128
  const tip = createCanvas(size, size)
  const context = context2d(tip)
  const { r, g, b } = hexToRgb(color)
  const center = size / 2
  const gradient = context.createRadialGradient(center, center, 0, center, center, center)
  const solid = `rgba(${r}, ${g}, ${b}, 1)`
  gradient.addColorStop(0, solid)
  gradient.addColorStop(Math.min(0.98, Math.max(0, hardness)), solid)
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  context.fillStyle = gradient
  context.beginPath()
  context.arc(center, center, center, 0, Math.PI * 2)
  context.fill()
  if (tipCache.size > 64) tipCache.clear()
  tipCache.set(key, tip)
  return tip
}

/**
 * One brush or eraser stroke from pointer down to pointer up.
 *
 * Dabs are collected on a separate stroke canvas at full strength; the layer
 * shows "before + stroke at the chosen opacity". That way overlapping dabs
 * do not get darker, and the opacity is even along the whole stroke.
 */
export class BrushStroke {
  private readonly before: HTMLCanvasElement
  private readonly stroke: HTMLCanvasElement
  private readonly smoother: Smoother
  private last: StrokePoint | null = null
  private carry = 0
  private bounds: Rect | null = null
  private dirty: Rect | null = null
  private frame = 0

  constructor(
    private readonly layer: Layer,
    private readonly settings: BrushSettings
  ) {
    const { width, height } = layer.canvas
    this.before = createCanvas(width, height)
    context2d(this.before).drawImage(layer.canvas, 0, 0)
    this.stroke = createCanvas(width, height)
    this.smoother = new Smoother(settings.smoothing)
  }

  /** Diameter for a pen pressure. Mouse and touch draw at full size. */
  private sizeFor(pressure: number): number {
    return Math.max(1, this.settings.size * (0.25 + 0.75 * pressure))
  }

  add(point: StrokePoint): void {
    const smooth = this.smoother.push(point)
    if (!this.last) {
      this.dab(smooth)
      this.last = smooth
    } else {
      // Dabs closer than a quarter of the size look like a smooth line.
      const spacing = Math.max(0.5, this.sizeFor(smooth.pressure) * 0.12)
      const { dabs, carry } = interpolateDabs(this.last, smooth, spacing, this.carry)
      dabs.forEach((dab) => this.dab(dab))
      this.carry = carry
      this.last = smooth
    }
    this.schedule()
  }

  private dab(point: StrokePoint): void {
    const size = this.sizeFor(point.pressure)
    const tip = brushTip(this.settings.erase ? '#000000' : this.settings.color, this.settings.hardness)
    const rect = { x: point.x - size / 2 - 1, y: point.y - size / 2 - 1, width: size + 2, height: size + 2 }
    context2d(this.stroke).drawImage(tip, point.x - size / 2, point.y - size / 2, size, size)
    this.bounds = unionRect(this.bounds, rect)
    this.dirty = unionRect(this.dirty, rect)
  }

  private schedule(): void {
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.render()
    })
  }

  /** Redraws only the part of the layer that changed since the last frame. */
  private render(): void {
    if (!this.dirty) return
    const rect = clipRect(this.dirty, this.layer.canvas.width, this.layer.canvas.height)
    this.dirty = null
    if (!rect) return
    const context = context2d(this.layer.canvas)
    const { x, y, width, height } = rect
    context.save()
    context.clearRect(x, y, width, height)
    context.drawImage(this.before, x, y, width, height, x, y, width, height)
    context.globalAlpha = this.settings.opacity
    context.globalCompositeOperation = this.settings.erase ? 'destination-out' : 'source-over'
    context.drawImage(this.stroke, x, y, width, height, x, y, width, height)
    context.restore()
  }

  /** Ends the stroke and records one undo step for the changed area. */
  finish(label: string): void {
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
    this.render()
    const rect = this.bounds && clipRect(this.bounds, this.layer.canvas.width, this.layer.canvas.height)
    if (!rect) return
    const before = context2d(this.before).getImageData(rect.x, rect.y, rect.width, rect.height)
    const after = context2d(this.layer.canvas).getImageData(rect.x, rect.y, rect.width, rect.height)
    record(pixelStep(label, this.layer, rect, before, after))
  }

  /** Cancels the stroke, e.g. when Escape is pressed. */
  cancel(): void {
    if (this.frame) cancelAnimationFrame(this.frame)
    const context = context2d(this.layer.canvas)
    context.clearRect(0, 0, this.layer.canvas.width, this.layer.canvas.height)
    context.drawImage(this.before, 0, 0)
    touch()
  }
}

/** The layer the tools paint on, if it can be painted on. */
export function paintableLayer(): Layer | null {
  const doc = getDoc()
  const layer = doc.layers.find((item) => item.id === doc.activeLayerId)
  return layer && layer.visible ? layer : null
}
