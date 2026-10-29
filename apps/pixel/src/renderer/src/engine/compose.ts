import { rgbToHex } from './color'
import { context2d, createCanvas, type PixelDocument } from './document'

/** All visible layers merged into one canvas, e.g. for export. */
export function flatten(doc: PixelDocument, background?: string): HTMLCanvasElement {
  const canvas = createCanvas(doc.width, doc.height)
  const context = context2d(canvas)
  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, doc.width, doc.height)
  }
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity === 0) continue
    context.globalAlpha = layer.opacity
    context.drawImage(layer.canvas, 0, 0)
  }
  context.globalAlpha = 1
  return canvas
}

/** Color of the visible picture at a point (for the color picker tool). Null if transparent. */
export function sampleColor(doc: PixelDocument, x: number, y: number): string | null {
  const px = Math.floor(x)
  const py = Math.floor(y)
  if (px < 0 || py < 0 || px >= doc.width || py >= doc.height) return null
  const probe = createCanvas(1, 1)
  const context = context2d(probe)
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity === 0) continue
    context.globalAlpha = layer.opacity
    context.drawImage(layer.canvas, px, py, 1, 1, 0, 0, 1, 1)
  }
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
  if (!a) return null
  // Undo the darkening of half transparent pixels.
  const alpha = a / 255
  return rgbToHex({ r: r! / alpha, g: g! / alpha, b: b! / alpha })
}

export function canvasToBytes(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Encoding failed'))
        else blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject)
      },
      type,
      quality
    )
  })
}
