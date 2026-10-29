import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'

/**
 * The .pixel project format of Dulidan Pixel.
 *
 * A .pixel file is a ZIP archive:
 *
 *   mimetype          "application/x-dulidan-pixel", stored first, uncompressed
 *   manifest.json     format name and version, app version, canvas size, dates
 *   document.json     the layers: name, visibility, opacity, order, image file
 *   layers/layer-N.png  one PNG per layer, full canvas size
 *
 * Newer format versions than supported are refused with a clear message.
 */

export const PIXEL_MIMETYPE = 'application/x-dulidan-pixel'
export const PIXEL_FORMAT_NAME = 'dulidan-pixel'
export const PIXEL_FORMAT_VERSION = 1
export const PIXEL_EXTENSION = 'pixel'

/** Largest canvas side Pixel accepts. */
export const PIXEL_MAX_SIDE = 8000

export interface PixelLayerData {
  id: string
  name: string
  visible: boolean
  /** 0 to 1 */
  opacity: number
  /** PNG image of the layer in full canvas size. */
  png: Uint8Array
}

export interface PixelProject {
  width: number
  height: number
  /** Bottom layer first. */
  layers: PixelLayerData[]
  activeLayerId: string
  createdAt: string
  modifiedAt: string
}

export interface PixelManifest {
  format: typeof PIXEL_FORMAT_NAME
  formatVersion: number
  appVersion: string
  width: number
  height: number
  createdAt: string
  modifiedAt: string
}

interface DocumentJson {
  activeLayerId: string
  layers: Array<{ id: string; name: string; visible: boolean; opacity: number; file: string }>
}

export type PixelFormatErrorCode = 'not-a-pixel-file' | 'newer-version' | 'damaged'

export class PixelFormatError extends Error {
  constructor(
    readonly code: PixelFormatErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'PixelFormatError'
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]

function isPng(bytes: Uint8Array | undefined): bytes is Uint8Array {
  return !!bytes && PNG_SIGNATURE.every((value, index) => bytes[index] === value)
}

function validSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= PIXEL_MAX_SIDE
}

/** Packs a project into the bytes of a .pixel file. */
export function serializePixel(project: PixelProject, appVersion: string): Uint8Array {
  const files: Zippable = {}
  const documentJson: DocumentJson = {
    activeLayerId: project.activeLayerId,
    layers: project.layers.map((layer, index) => {
      const file = `layers/layer-${index + 1}.png`
      // PNGs are already compressed.
      files[file] = [layer.png, { level: 0 }]
      return { id: layer.id, name: layer.name, visible: layer.visible, opacity: layer.opacity, file }
    })
  }
  const manifest: PixelManifest = {
    format: PIXEL_FORMAT_NAME,
    formatVersion: PIXEL_FORMAT_VERSION,
    appVersion,
    width: project.width,
    height: project.height,
    createdAt: project.createdAt,
    modifiedAt: project.modifiedAt
  }
  return zipSync({
    mimetype: [strToU8(PIXEL_MIMETYPE), { level: 0 }],
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'document.json': strToU8(JSON.stringify(documentJson, null, 2)),
    ...files
  })
}

/** Reads the bytes of a .pixel file back into a project. */
export function parsePixel(bytes: Uint8Array): PixelProject {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch {
    throw new PixelFormatError('not-a-pixel-file', 'The file is not a ZIP archive.')
  }
  const mimetype = entries['mimetype'] ? strFromU8(entries['mimetype']) : ''
  if (mimetype !== PIXEL_MIMETYPE || !entries['manifest.json'] || !entries['document.json']) {
    throw new PixelFormatError('not-a-pixel-file', 'The archive is not a Pixel project.')
  }

  let manifest: PixelManifest
  let documentJson: DocumentJson
  try {
    manifest = JSON.parse(strFromU8(entries['manifest.json'])) as PixelManifest
    documentJson = JSON.parse(strFromU8(entries['document.json'])) as DocumentJson
  } catch {
    throw new PixelFormatError('damaged', 'manifest.json or document.json is not valid JSON.')
  }

  if (manifest.format !== PIXEL_FORMAT_NAME || typeof manifest.formatVersion !== 'number') {
    throw new PixelFormatError('not-a-pixel-file', 'Unknown format in manifest.json.')
  }
  if (manifest.formatVersion > PIXEL_FORMAT_VERSION) {
    throw new PixelFormatError(
      'newer-version',
      `File format ${manifest.formatVersion} is newer than supported version ${PIXEL_FORMAT_VERSION}.`
    )
  }
  if (!validSize(manifest.width) || !validSize(manifest.height) || !Array.isArray(documentJson.layers)) {
    throw new PixelFormatError('damaged', 'Invalid canvas size or layer list.')
  }

  const layers: PixelLayerData[] = documentJson.layers.map((layer, index) => {
    const png = entries[layer.file]
    if (!isPng(png)) throw new PixelFormatError('damaged', `Layer image ${layer.file} is missing or not a PNG.`)
    return {
      id: typeof layer.id === 'string' && layer.id ? layer.id : `layer-${index + 1}`,
      name: typeof layer.name === 'string' ? layer.name : `Ebene ${index + 1}`,
      visible: layer.visible !== false,
      opacity: typeof layer.opacity === 'number' ? Math.min(1, Math.max(0, layer.opacity)) : 1,
      png
    }
  })
  if (layers.length === 0) throw new PixelFormatError('damaged', 'The project has no layers.')

  const now = new Date().toISOString()
  return {
    width: manifest.width,
    height: manifest.height,
    layers,
    activeLayerId: layers.some((layer) => layer.id === documentJson.activeLayerId)
      ? documentJson.activeLayerId
      : layers[layers.length - 1]!.id,
    createdAt: typeof manifest.createdAt === 'string' ? manifest.createdAt : now,
    modifiedAt: typeof manifest.modifiedAt === 'string' ? manifest.modifiedAt : now
  }
}
