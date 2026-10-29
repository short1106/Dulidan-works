import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'

/**
 * The .glyph file format.
 *
 * A .glyph file is a ZIP archive:
 *
 *   mimetype        "application/x-dulidan-glyph", stored first and uncompressed
 *   manifest.json   format name, format version, app version, dates
 *   document.json   the document content (editor JSON)
 *   images/...      every image as its own file
 *
 * Inside the editor, images are data URLs. On save they are moved into
 * images/ and the document points to them by path; on load it is reversed.
 *
 * The format version is raised whenever the structure changes. Older files
 * are upgraded with MIGRATIONS on load, newer files are refused with a clear
 * message instead of being misread.
 */

export const GLYPH_MIMETYPE = 'application/x-dulidan-glyph'
export const GLYPH_FORMAT_NAME = 'dulidan-glyph'
export const GLYPH_FORMAT_VERSION = 1
export const GLYPH_EXTENSION = 'glyph'

/** A node of the editor document (ProseMirror / TipTap JSON). */
export interface DocNode {
  type: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

export interface GlyphManifest {
  format: typeof GLYPH_FORMAT_NAME
  formatVersion: number
  appVersion: string
  createdAt: string
  modifiedAt: string
}

export interface GlyphDocument {
  content: DocNode
  createdAt: string
  modifiedAt: string
}

export type GlyphFormatErrorCode = 'not-a-glyph-file' | 'newer-version' | 'damaged'

/** Thrown when a file cannot be read. `code` decides the message for the user. */
export class GlyphFormatError extends Error {
  constructor(
    readonly code: GlyphFormatErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'GlyphFormatError'
  }
}

/** An empty document with one empty paragraph. */
export function createEmptyDocument(now = new Date()): GlyphDocument {
  const timestamp = now.toISOString()
  return {
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    createdAt: timestamp,
    modifiedAt: timestamp
  }
}

const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp'
}

function mimeForExtension(extension: string): string {
  const entry = Object.entries(IMAGE_TYPES).find(([, ext]) => ext === extension)
  return entry ? entry[0] : 'application/octet-stream'
}

const DATA_URL = /^data:([a-z0-9.+/-]+);base64,(.*)$/is

function base64ToBytes(base64: string): Uint8Array {
  return strToU8(atob(base64), true)
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(strFromU8(bytes, true))
}

/** Calls `visit` on every node of the tree and returns a changed copy. */
function mapNodes(node: DocNode, visit: (node: DocNode) => DocNode): DocNode {
  const mapped = visit({ ...node })
  if (mapped.content) mapped.content = mapped.content.map((child) => mapNodes(child, visit))
  return mapped
}

/** Packs a document into the bytes of a .glyph file. */
export function serializeGlyph(doc: GlyphDocument, appVersion: string): Uint8Array {
  const files: Zippable = {}
  // Same image twice in the document -> stored once.
  const pathBySource = new Map<string, string>()

  const content = mapNodes(doc.content, (node) => {
    const src = node.type === 'image' ? node.attrs?.['src'] : undefined
    if (typeof src !== 'string') return node
    const match = DATA_URL.exec(src)
    if (!match) return node
    let path = pathBySource.get(src)
    if (!path) {
      const extension = IMAGE_TYPES[match[1]!.toLowerCase()] ?? 'bin'
      path = `images/image-${pathBySource.size + 1}.${extension}`
      pathBySource.set(src, path)
      // Images are already compressed, zipping them again only costs time.
      files[path] = [base64ToBytes(match[2]!), { level: 0 }]
    }
    return { ...node, attrs: { ...node.attrs, src: path } }
  })

  const manifest: GlyphManifest = {
    format: GLYPH_FORMAT_NAME,
    formatVersion: GLYPH_FORMAT_VERSION,
    appVersion,
    createdAt: doc.createdAt,
    modifiedAt: doc.modifiedAt
  }

  return zipSync({
    mimetype: [strToU8(GLYPH_MIMETYPE), { level: 0 }],
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'document.json': strToU8(JSON.stringify(content)),
    ...files
  })
}

/**
 * Upgrades older document structures, step by step. Key = version the
 * migration starts from. Empty while there is only version 1.
 */
const MIGRATIONS: Record<number, (content: DocNode) => DocNode> = {}

/** Reads the bytes of a .glyph file back into a document. */
export function parseGlyph(bytes: Uint8Array): GlyphDocument {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch {
    throw new GlyphFormatError('not-a-glyph-file', 'The file is not a ZIP archive.')
  }

  const mimetype = entries['mimetype'] ? strFromU8(entries['mimetype']) : ''
  if (mimetype !== GLYPH_MIMETYPE || !entries['manifest.json'] || !entries['document.json']) {
    throw new GlyphFormatError('not-a-glyph-file', 'The archive is not a Glyph document.')
  }

  let manifest: GlyphManifest
  let content: DocNode
  try {
    manifest = JSON.parse(strFromU8(entries['manifest.json'])) as GlyphManifest
    content = JSON.parse(strFromU8(entries['document.json'])) as DocNode
  } catch {
    throw new GlyphFormatError('damaged', 'manifest.json or document.json is not valid JSON.')
  }

  if (manifest.format !== GLYPH_FORMAT_NAME || typeof manifest.formatVersion !== 'number') {
    throw new GlyphFormatError('not-a-glyph-file', 'Unknown format in manifest.json.')
  }
  if (manifest.formatVersion > GLYPH_FORMAT_VERSION) {
    throw new GlyphFormatError(
      'newer-version',
      `File format ${manifest.formatVersion} is newer than supported version ${GLYPH_FORMAT_VERSION}.`
    )
  }
  if (content?.type !== 'doc') {
    throw new GlyphFormatError('damaged', 'document.json has no document root.')
  }

  for (let version = manifest.formatVersion; version < GLYPH_FORMAT_VERSION; version++) {
    const migrate = MIGRATIONS[version]
    if (migrate) content = migrate(content)
  }

  // Put the images back into the document as data URLs.
  content = mapNodes(content, (node) => {
    const src = node.type === 'image' ? node.attrs?.['src'] : undefined
    if (typeof src !== 'string' || !src.startsWith('images/')) return node
    const data = entries[src]
    if (!data) return { ...node, attrs: { ...node.attrs, src: '' } } // missing image: keep the text intact
    const extension = src.slice(src.lastIndexOf('.') + 1).toLowerCase()
    return { ...node, attrs: { ...node.attrs, src: `data:${mimeForExtension(extension)};base64,${bytesToBase64(data)}` } }
  })

  const now = new Date().toISOString()
  return {
    content,
    createdAt: typeof manifest.createdAt === 'string' ? manifest.createdAt : now,
    modifiedAt: typeof manifest.modifiedAt === 'string' ? manifest.modifiedAt : now
  }
}

/** Counts the words of a document, e.g. for previews. */
export function countWords(node: DocNode): number {
  let text = ''
  const walk = (current: DocNode): void => {
    if (current.text) text += current.text
    current.content?.forEach(walk)
    text += ' '
  }
  walk(node)
  return text.split(/\s+/).filter(Boolean).length
}
