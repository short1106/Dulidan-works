import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'

/**
 * Links between notes, written as [[Notiztitel]] right in the text (so the
 * Markdown file keeps them as they are). This extension
 *   - marks them in the editor (class "wiki-link"),
 *   - shows a suggestion list of note titles after typing "[[".
 * Opening a link (Strg + Klick) is handled by the editor component.
 */

export interface LinkSuggestion {
  path: string | null
  title: string
}

export interface SuggestionUi {
  /** null hides the list. */
  show(state: { items: LinkSuggestion[]; index: number; rect: DOMRect | null; select: (item: LinkSuggestion) => void } | null): void
}

export interface WikiLinkOptions {
  suggest: (text: string) => Promise<LinkSuggestion[]>
  ui: SuggestionUi
}

const WIKI_LINK = /\[\[([^\[\]\n|]+?)(\|[^\[\]\n]*)?\]\]/g
const decorationsKey = new PluginKey('wikiLinkDecorations')

function findDecorations(doc: PmNode): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    // Text of the block; other inline nodes (images, breaks) count as one character.
    let text = ''
    node.forEach((child) => {
      text += child.isText ? (child.text ?? '') : '￼'
    })
    for (const match of text.matchAll(WIKI_LINK)) {
      const from = pos + 1 + match.index!
      decorations.push(
        Decoration.inline(from, from + match[0].length, {
          class: 'wiki-link',
          'data-target': match[1]!.trim(),
          title: 'Strg + Klick öffnet die Notiz'
        })
      )
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

export const WikiLinks = Extension.create<WikiLinkOptions>({
  name: 'wikiLinks',

  addOptions() {
    return { suggest: async () => [], ui: { show: () => undefined } }
  },

  addProseMirrorPlugins() {
    const { suggest, ui } = this.options
    let items: LinkSuggestion[] = []
    let index = 0
    let current: SuggestionProps<LinkSuggestion> | null = null

    const render = (): void => {
      if (!current) return ui.show(null)
      ui.show({ items, index, rect: current.clientRect?.() ?? null, select: (item) => current?.command(item) })
    }

    return [
      new Plugin({
        key: decorationsKey,
        state: {
          init: (_config, state) => findDecorations(state.doc),
          apply: (transaction, old) => (transaction.docChanged ? findDecorations(transaction.doc) : old)
        },
        props: {
          decorations: (state) => decorationsKey.getState(state) as DecorationSet
        }
      }),
      Suggestion<LinkSuggestion>({
        editor: this.editor,
        char: '[[',
        allowSpaces: true,
        allowedPrefixes: null,
        // A finished link ("[[Titel]]") needs no more suggestions.
        allow: ({ state, range }) => !state.doc.textBetween(range.from, range.to, '').slice(2).includes(']'),
        items: async ({ query }) => {
          const text = query.replace(/\]+$/, '')
          const found = await suggest(text)
          const exact = found.some((item) => item.title.toLowerCase() === text.trim().toLowerCase())
          return text.trim() && !exact ? [...found, { path: null, title: text.trim() }] : found
        },
        command: ({ editor, range, props }) => {
          // Also swallow "]]" typed already after the cursor.
          const after = editor.state.doc.textBetween(range.to, Math.min(range.to + 2, editor.state.doc.content.size), '')
          const to = after === ']]' ? range.to + 2 : range.to
          editor.chain().focus().insertContentAt({ from: range.from, to }, `[[${props.title}]]`).run()
        },
        render: () => ({
          onStart: (props) => {
            current = props
            items = props.items
            index = 0
            render()
          },
          onUpdate: (props) => {
            current = props
            items = props.items
            index = Math.min(index, Math.max(0, items.length - 1))
            render()
          },
          onKeyDown: ({ event }: SuggestionKeyDownProps) => {
            if (!current || items.length === 0) return false
            if (event.key === 'ArrowDown') index = (index + 1) % items.length
            else if (event.key === 'ArrowUp') index = (index + items.length - 1) % items.length
            else if (event.key === 'Enter' || event.key === 'Tab') {
              const item = items[index]
              if (item) current.command(item)
              return true
            } else if (event.key === 'Escape') {
              current = null
              render()
              return true
            } else return false
            render()
            return true
          },
          onExit: () => {
            current = null
            render()
          }
        })
      })
    ]
  }
})
