import { isNoteColor, type Note, type NoteMeta } from './types'

/**
 * Every note file starts with a small header between two "---" lines
 * (called "front matter"; many Markdown programs understand it):
 *
 *   ---
 *   title: Einkaufsliste
 *   tags: [haushalt, wichtig]
 *   created: 2026-10-29T16:00:00.000Z
 *   modified: 2026-10-29T16:05:00.000Z
 *   ---
 *   - [ ] Milch
 *
 * Only this simple subset of YAML is read and written. Lines Cortex does not
 * know are kept as they are, so headers from other programs survive.
 */

const KNOWN = new Set(['title', 'tags', 'created', 'modified', 'pinned', 'color', 'deleted', 'original'])

export interface MetaDefaults {
  title: string
  created: string
  modified: string
}

function unquote(value: string): string {
  const text = value.trim()
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    try {
      return JSON.parse(text) as string
    } catch {
      return text.slice(1, -1)
    }
  }
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) return text.slice(1, -1).replace(/''/g, "'")
  return text
}

/** Writes a string so YAML reads it back unchanged (JSON strings are valid YAML). */
function quote(value: string): string {
  if (value === '' || /^[\s]|[\s]$|[:#[\]{},"'&*!|>%@`]|^[-?]|^(true|false|null|yes|no|~|\d[\d.:-]*)$/i.test(value)) return JSON.stringify(value)
  return value
}

function parseList(value: string, following: string[]): { items: string[]; consumed: number } {
  const text = value.trim()
  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim()
    if (!inner) return { items: [], consumed: 0 }
    // Split at commas outside of quotes.
    const items: string[] = []
    let current = ''
    let quoteChar: string | null = null
    for (const char of inner) {
      if (quoteChar) {
        if (char === quoteChar) quoteChar = null
        current += char
      } else if (char === '"' || char === "'") {
        quoteChar = char
        current += char
      } else if (char === ',') {
        items.push(unquote(current))
        current = ''
      } else current += char
    }
    items.push(unquote(current))
    return { items: items.filter(Boolean), consumed: 0 }
  }
  if (text) return { items: [unquote(text)], consumed: 0 }
  // Block list:
  //   tags:
  //     - a
  const items: string[] = []
  let consumed = 0
  for (const line of following) {
    const match = /^\s*-\s+(.*)$/.exec(line)
    if (!match) break
    items.push(unquote(match[1]!))
    consumed++
  }
  return { items: items.filter(Boolean), consumed }
}

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .replace(/^#/, '')
    .replace(/[\s,]+/g, '-')
    .toLowerCase()
    .slice(0, 60)
}

function cleanTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))]
}

function validDate(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const time = Date.parse(value)
  return Number.isNaN(time) ? fallback : new Date(time).toISOString()
}

/** Splits file text into header lines and body. Returns null lines if there is no header. */
function splitFile(text: string): { lines: string[] | null; body: string } {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  if (!normalized.startsWith('---\n')) return { lines: null, body: normalized }
  const end = normalized.indexOf('\n---', 3)
  if (end === -1) return { lines: null, body: normalized }
  const after = normalized.slice(end + 4)
  if (after !== '' && !after.startsWith('\n')) return { lines: null, body: normalized }
  return { lines: normalized.slice(4, end).split('\n'), body: after.replace(/^\n/, '') }
}

/** Reads a note file. Missing header fields come from the defaults (file name, file dates). */
export function parseNote(text: string, defaults: MetaDefaults): Note {
  const { lines, body } = splitFile(text)
  const meta: NoteMeta = {
    title: defaults.title,
    tags: [],
    created: defaults.created,
    modified: defaults.modified,
    pinned: false,
    color: null,
    deleted: null,
    original: null,
    extra: []
  }
  if (!lines) return { meta, body }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const match = /^([A-Za-z_][\w-]*):(.*)$/.exec(line)
    const key = match?.[1]?.toLowerCase()
    if (!match || !key || !KNOWN.has(key)) {
      if (line.trim()) meta.extra.push(line)
      continue
    }
    const value = match[2]!
    switch (key) {
      case 'title': {
        const title = unquote(value).trim()
        if (title) meta.title = title
        break
      }
      case 'tags': {
        const list = parseList(value, lines.slice(i + 1))
        meta.tags = cleanTags(list.items)
        i += list.consumed
        break
      }
      case 'created':
        meta.created = validDate(unquote(value), defaults.created)
        break
      case 'modified':
        meta.modified = validDate(unquote(value), defaults.modified)
        break
      case 'pinned':
        meta.pinned = unquote(value).toLowerCase() === 'true'
        break
      case 'color': {
        const color = unquote(value).toLowerCase()
        meta.color = isNoteColor(color) ? color : null
        break
      }
      case 'deleted':
        meta.deleted = validDate(unquote(value), new Date().toISOString())
        break
      case 'original':
        meta.original = unquote(value) || null
        break
    }
  }
  return { meta, body }
}

/** Writes a note file: header, then the Markdown text. */
export function serializeNote(note: Note): string {
  const { meta } = note
  const lines = ['---', `title: ${quote(meta.title)}`]
  const tags = cleanTags(meta.tags)
  if (tags.length > 0) lines.push(`tags: [${tags.map(quote).join(', ')}]`)
  lines.push(`created: ${meta.created}`, `modified: ${meta.modified}`)
  if (meta.pinned) lines.push('pinned: true')
  if (meta.color) lines.push(`color: ${meta.color}`)
  if (meta.deleted) lines.push(`deleted: ${meta.deleted}`)
  if (meta.original) lines.push(`original: ${quote(meta.original)}`)
  lines.push(...meta.extra, '---')
  const body = note.body.replace(/\r\n?/g, '\n').replace(/\s+$/, '')
  return `${lines.join('\n')}\n${body ? `${body}\n` : ''}`
}
