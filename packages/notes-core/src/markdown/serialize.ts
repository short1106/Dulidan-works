/**
 * Turns the editor content (TipTap/ProseMirror JSON) into Markdown text.
 * Only what Markdown can express exists in the Cortex editor: headings,
 * bold, italic, lists, checklists, links, images, simple tables, quotes
 * and code. Image sizes are written as a small HTML line (<img width>),
 * which most Markdown programs show correctly.
 */

export interface JsonMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface JsonNode {
  type: string
  attrs?: Record<string, unknown>
  content?: JsonNode[]
  marks?: JsonMark[]
  text?: string
}

export interface SerializeOptions {
  /** Changes image addresses from the window form to the file form. */
  imageSrc?: (src: string) => string
  /** The same for link addresses (links to attached files). */
  linkHref?: (href: string) => string
}

const MARK_ORDER = ['link', 'bold', 'italic', 'code']

function attr(node: { attrs?: Record<string, unknown> }, name: string): unknown {
  return node.attrs?.[name]
}

function stringAttr(node: { attrs?: Record<string, unknown> }, name: string): string {
  const value = attr(node, name)
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

/** Escapes characters that Markdown would read as formatting. */
export function escapeText(text: string, atLineStart: boolean): string {
  let result = text
    .replace(/\\/g, '\\\\')
    .replace(/([*`])/g, '\\$1')
    .replace(/(^|[^\p{L}\p{N}])_|_(?=[^\p{L}\p{N}]|$)/gu, (match) => match.replace('_', '\\_'))
    .replace(/<(?=[A-Za-z/!?])/g, '\\<')
  if (atLineStart) {
    result = result
      .replace(/^(\s*)(#{1,6}(\s|$))/, '$1\\$2')
      .replace(/^(\s*)([>+-])(\s|$)/, '$1\\$2$3')
      .replace(/^(\s*)(\d+)([.)])(\s|$)/, '$1$2\\$3$4')
      .replace(/^(\s*)(=+|-{3,}|~~~)/, '$1\\$2')
  }
  return result
}

function sameMark(a: JsonMark, b: JsonMark): boolean {
  return a.type === b.type && (a.type !== 'link' || stringAttr(a, 'href') === stringAttr(b, 'href'))
}

function sortedMarks(node: JsonNode): JsonMark[] {
  return (node.marks ?? []).filter((mark) => MARK_ORDER.includes(mark.type)).sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type))
}

function openMark(mark: JsonMark): string {
  if (mark.type === 'bold') return '**'
  if (mark.type === 'italic') return '*'
  if (mark.type === 'link') return '['
  return ''
}

function closeMark(mark: JsonMark, options: SerializeOptions): string {
  if (mark.type === 'bold') return '**'
  if (mark.type === 'italic') return '*'
  if (mark.type === 'link') {
    const href = stringAttr(mark, 'href')
    return `](${linkTarget(options.linkHref ? options.linkHref(href) : href)})`
  }
  return ''
}

function linkTarget(href: string): string {
  return /[\s()<>]/.test(href) ? `<${href.replace(/[<>]/g, encodeURIComponent)}>` : href
}

function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(longest + 1)
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : ''
  return `${fence}${pad}${text}${pad}${fence}`
}

/**
 * Inline content (text with bold, italic, links, code, line breaks, images).
 * Marks are opened and closed like brackets; spaces at the edge of a
 * formatted piece are moved outside, because "** fett**" is not bold.
 */
function inline(nodes: JsonNode[] | undefined, options: SerializeOptions, breakText: string): string {
  let out = ''
  const open: JsonMark[] = []
  let pendingSpace = ''

  const closeTo = (keep: number): void => {
    while (open.length > keep) out += closeMark(open.pop()!, options)
  }

  for (const node of nodes ?? []) {
    const marks = node.type === 'text' ? sortedMarks(node) : []
    const code = marks.find((mark) => mark.type === 'code')
    const outer = marks.filter((mark) => mark.type !== 'code')
    let keep = 0
    while (keep < open.length && keep < outer.length && sameMark(open[keep]!, outer[keep]!)) keep++
    closeTo(keep)
    out += pendingSpace
    pendingSpace = ''

    if (node.type === 'text') {
      const text = node.text ?? ''
      const lead = outer.length > open.length ? /^\s*/.exec(text)![0] : ''
      const rest = text.slice(lead.length)
      const trail = outer.length > 0 ? /\s*$/.exec(rest)![0] : ''
      const core = rest.slice(0, rest.length - trail.length)
      out += lead
      for (const mark of outer.slice(open.length)) {
        out += openMark(mark)
        open.push(mark)
      }
      out += code ? codeSpan(core) : escapeText(core, out.length === 0 || out.endsWith('\n'))
      pendingSpace = trail
    } else if (node.type === 'hardBreak') {
      out += breakText
    } else if (node.type === 'image') {
      out += image(node, options)
    }
  }
  closeTo(0)
  return out + pendingSpace
}

function image(node: JsonNode, options: SerializeOptions): string {
  const raw = stringAttr(node, 'src')
  const src = options.imageSrc ? options.imageSrc(raw) : raw
  const alt = stringAttr(node, 'alt')
  const title = stringAttr(node, 'title')
  const width = Number(attr(node, 'width'))
  if (Number.isFinite(width) && width > 0) {
    const escape = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
    return `<img src="${escape(src)}" alt="${escape(alt)}" width="${Math.round(width)}">`
  }
  const cleanAlt = alt.replace(/[\[\]\\]/g, '\\$&')
  const cleanTitle = title ? ` "${title.replace(/"/g, '\\"')}"` : ''
  return `![${cleanAlt}](${linkTarget(src)}${cleanTitle})`
}

function indent(text: string, prefix: string, firstPrefix = prefix): string {
  return text
    .split('\n')
    .map((line, index) => (line === '' ? '' : (index === 0 ? firstPrefix : prefix) + line))
    .join('\n')
}

function tableCell(cell: JsonNode, options: SerializeOptions): string {
  const parts = (cell.content ?? []).map((child) => (child.type === 'paragraph' || child.type === 'heading' ? inline(child.content, options, '<br>') : plainOf(child)))
  return parts.join('<br>').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()
}

function plainOf(node: JsonNode): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(plainOf).join(' ')
}

function table(node: JsonNode, options: SerializeOptions): string {
  const rows = (node.content ?? []).map((row) => (row.content ?? []).map((cell) => tableCell(cell, options)))
  if (rows.length === 0) return ''
  const columns = Math.max(...rows.map((row) => row.length), 1)
  const pad = (row: string[]): string[] => [...row, ...Array<string>(columns - row.length).fill('')]
  const line = (row: string[]): string => `| ${pad(row).map((cell) => cell || ' ').join(' | ')} |`
  return [line(rows[0]!), `| ${Array<string>(columns).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n')
}

function list(node: JsonNode, options: SerializeOptions): string {
  const ordered = node.type === 'orderedList'
  let number = Number(attr(node, 'start')) || 1
  return (node.content ?? [])
    .map((item) => {
      let marker: string
      if (node.type === 'taskList') marker = attr(item, 'checked') === true ? '- [x] ' : '- [ ] '
      else if (ordered) marker = `${number++}. `
      else marker = '- '
      const body = itemBlocks(item.content ?? [], options)
      // An empty item keeps its marker (a checklist box stays "- [ ] ").
      if (!body) return node.type === 'taskList' ? marker : marker.trimEnd()
      return indent(body, ' '.repeat(ordered ? marker.length : 2), marker)
    })
    .join('\n')
}

/** Content of a list item: a list right below its first line stays without a blank line. */
function itemBlocks(nodes: JsonNode[], options: SerializeOptions): string {
  let out = ''
  for (const node of nodes) {
    const text = block(node, options)
    if (!text) continue
    if (out) out += /List$/.test(node.type) ? '\n' : '\n\n'
    out += text
  }
  return out
}

function block(node: JsonNode, options: SerializeOptions): string {
  switch (node.type) {
    case 'paragraph':
      return inline(node.content, options, '\\\n')
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(attr(node, 'level')) || 1))
      return `${'#'.repeat(level)} ${inline(node.content, options, ' ')}`
    }
    case 'blockquote':
      return indent(blocks(node.content ?? [], options), '> ').replace(/^$/gm, '>')
    case 'codeBlock': {
      const text = (node.content ?? []).map((child) => child.text ?? '').join('')
      const longest = Math.max(2, ...(text.match(/^`{3,}/gm) ?? []).map((run) => run.length))
      const fence = '`'.repeat(longest + 1)
      return `${fence}${stringAttr(node, 'language')}\n${text}\n${fence}`
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return list(node, options)
    case 'image':
      return image(node, options)
    case 'table':
      return table(node, options)
    case 'horizontalRule':
      return '---'
    default:
      return node.content ? blocks(node.content, options) : ''
  }
}

function blocks(nodes: JsonNode[], options: SerializeOptions): string {
  const parts: string[] = []
  let previous: JsonNode | null = null
  for (const node of nodes) {
    const text = block(node, options)
    // Two lists of the same kind right after each other would merge; a comment keeps them apart.
    if (previous && previous.type === node.type && /List$/.test(node.type)) parts.push('<!-- -->')
    parts.push(text)
    previous = node
  }
  // Empty paragraphs cannot be written in Markdown; blank lines separate blocks anyway.
  return parts.filter((part) => part !== '').join('\n\n')
}

/** Editor content -> Markdown text (without the header). */
export function toMarkdown(doc: JsonNode, options: SerializeOptions = {}): string {
  const text = blocks(doc.content ?? [], options).replace(/\n{3,}/g, '\n\n').trim()
  return text ? `${text}\n` : ''
}

/** Plain text -> Markdown: line breaks are kept and nothing turns into formatting by accident. */
export function plainTextToMarkdown(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) => escapeText(line, true))
        .join('\\\n')
    )
    .join('\n\n')
}
