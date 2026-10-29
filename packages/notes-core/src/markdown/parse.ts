import { Lexer, Marked, type Token, type Tokens } from 'marked'

/**
 * Markdown text -> HTML that the Cortex editor (TipTap) reads.
 * Uses "marked" (MIT) with GitHub-style tables and checklists. Checklists
 * are written in the form TipTap expects; image addresses can be changed
 * (file form -> window form). Unknown HTML is dropped by the editor itself.
 */
export interface ParseOptions {
  imageSrc?: (src: string) => string
  linkHref?: (href: string) => string
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function rewriteHtmlImages(html: string, imageSrc: (src: string) => string): string {
  return html.replace(/(<img\b[^>]*?\ssrc\s*=\s*)(["'])(.*?)\2/gi, (_whole, start: string, quoteChar: string, src: string) => `${start}${quoteChar}${escapeAttr(imageSrc(src))}${quoteChar}`)
}

export function markdownToHtml(markdown: string, options: ParseOptions = {}): string {
  const imageSrc = options.imageSrc ?? ((src: string) => src)
  const linkHref = options.linkHref ?? ((href: string) => href)
  const marked = new Marked({
    gfm: true,
    breaks: false,
    renderer: {
      list(this: { parser: { parse: (tokens: Token[]) => string } }, token: Tokens.List): string | false {
        if (!token.items.length || !token.items.every((item) => item.task)) return false
        const items = token.items
          .map((item) => {
            const content = this.parser.parse(item.tokens.filter((child) => child.type !== 'checkbox')).trim()
            const wrapped = /^<(p|ul|ol|h\d|blockquote|pre|table)\b/.test(content) ? content : `<p>${content}</p>`
            return `<li data-type="taskItem" data-checked="${item.checked ? 'true' : 'false'}">${wrapped}</li>`
          })
          .join('')
        return `<ul data-type="taskList">${items}</ul>\n`
      },
      // Inside mixed lists a checkbox stays visible as text.
      checkbox({ checked }: Tokens.Checkbox): string {
        return checked ? '[x] ' : '[ ] '
      },
      link(this: { parser: { parseInline: (tokens: Token[]) => string } }, { href, title, tokens }: Tokens.Link): string {
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
        return `<a href="${escapeAttr(linkHref(href))}"${titleAttr}>${this.parser.parseInline(tokens)}</a>`
      },
      image({ href, title, text }: Tokens.Image): string {
        const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
        return `<img src="${escapeAttr(imageSrc(href))}" alt="${escapeAttr(text)}"${titleAttr}>`
      },
      html({ text }: Tokens.HTML | Tokens.Tag): string {
        return rewriteHtmlImages(text, imageSrc)
      }
    }
  })
  return marked.parse(markdown, { async: false })
}

export interface PlainText {
  /** All words of the note for the search. */
  text: string
  tasksDone: number
  tasksTotal: number
  /** Address of the first image as written in the file. */
  firstImage: string | null
}

/** Markdown -> plain text, for the search index and the card preview. */
export function markdownToPlain(markdown: string): PlainText {
  const parts: string[] = []
  let tasksDone = 0
  let tasksTotal = 0
  let firstImage: string | null = null

  const walk = (tokens: Token[] | undefined): void => {
    for (const token of tokens ?? []) {
      switch (token.type) {
        case 'image':
          firstImage ??= (token as Tokens.Image).href
          if ((token as Tokens.Image).text) parts.push((token as Tokens.Image).text)
          break
        case 'html': {
          const src = /<img\b[^>]*?\ssrc\s*=\s*(["'])(.*?)\1/i.exec((token as Tokens.HTML).text)
          if (src) firstImage ??= src[2]!
          break
        }
        case 'list':
          for (const item of (token as Tokens.List).items) {
            if (item.task) {
              tasksTotal++
              if (item.checked) tasksDone++
            }
            walk(item.tokens)
          }
          break
        case 'table': {
          const table = token as Tokens.Table
          for (const cell of table.header) walk(cell.tokens)
          for (const row of table.rows) for (const cell of row) walk(cell.tokens)
          break
        }
        case 'code':
        case 'codespan':
          parts.push((token as Tokens.Code).text)
          break
        case 'text':
        case 'escape':
          if ('tokens' in token && token.tokens?.length) walk(token.tokens)
          else parts.push((token as Tokens.Text).text)
          break
        case 'space':
        case 'hr':
        case 'br':
        case 'checkbox':
          break
        default:
          if ('tokens' in token && token.tokens) walk(token.tokens)
          else if ('text' in token && typeof token.text === 'string') parts.push(token.text)
      }
    }
  }
  walk(new Lexer({ gfm: true }).lex(markdown))
  const text = parts
    .join(' ')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_m, name: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[name] ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return { text, tasksDone, tasksTotal, firstImage }
}
