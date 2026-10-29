import { PIXEL_MAX_SIDE, type PixelProject } from '@dulidan/core'
import { canvasToBytes } from './compose'
import { context2d, createCanvas, createLayer, type PixelDocument } from './document'

/** Turns the open picture into a project for saving (one PNG per layer). */
export async function documentToProject(doc: PixelDocument, createdAt: string): Promise<PixelProject> {
  const layers = await Promise.all(
    doc.layers.map(async (layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      png: await canvasToBytes(layer.canvas, 'image/png')
    }))
  )
  return { width: doc.width, height: doc.height, layers, activeLayerId: doc.activeLayerId, createdAt, modifiedAt: new Date().toISOString() }
}

async function decodeImage(bytes: Uint8Array, type: string): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([bytes as BlobPart], { type }))
}

/** Loads a saved project back into layers with canvases. */
export async function projectToDocument(project: PixelProject): Promise<PixelDocument> {
  const layers = await Promise.all(
    project.layers.map(async (data) => {
      const layer = createLayer(project.width, project.height, data.name)
      layer.id = data.id
      layer.visible = data.visible
      layer.opacity = data.opacity
      const bitmap = await decodeImage(data.png, 'image/png')
      context2d(layer.canvas).drawImage(bitmap, 0, 0)
      bitmap.close()
      return layer
    })
  )
  return { width: project.width, height: project.height, layers, activeLayerId: project.activeLayerId }
}

/**
 * Opens a PNG or JPG as a new picture with one layer. Very large photos are
 * scaled down to the biggest size Pixel supports.
 */
export async function imageToDocument(bytes: Uint8Array, type: string, layerName: string): Promise<PixelDocument> {
  const bitmap = await decodeImage(bytes, type)
  const scale = Math.min(1, PIXEL_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const layer = createLayer(width, height, layerName)
  const context = context2d(layer.canvas)
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return { width, height, layers: [layer], activeLayerId: layer.id }
}

/** Scales a canvas with good quality (for "Größe ändern"). */
export function resampleCanvas(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  // Big reductions in one step look grainy; halving step by step stays smooth.
  let current = source
  while (current.width / 2 >= width && current.height / 2 >= height) {
    const half = createCanvas(Math.max(width, Math.floor(current.width / 2)), Math.max(height, Math.floor(current.height / 2)))
    const context = context2d(half)
    context.imageSmoothingQuality = 'high'
    context.drawImage(current, 0, 0, half.width, half.height)
    current = half
  }
  const target = createCanvas(width, height)
  const context = context2d(target)
  context.imageSmoothingQuality = 'high'
  context.drawImage(current, 0, 0, width, height)
  return target
}

/** Cuts a canvas to a rectangle (for "Zuschneiden"). */
export function cropCanvas(source: HTMLCanvasElement, x: number, y: number, width: number, height: number): HTMLCanvasElement {
  const target = createCanvas(width, height)
  context2d(target).drawImage(source, -x, -y)
  return target
}
