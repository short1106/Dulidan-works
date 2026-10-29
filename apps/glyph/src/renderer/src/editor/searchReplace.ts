import { Extension, type Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * Search and replace for the editor.
 *
 * A ProseMirror plugin keeps the search term and all matches and highlights
 * them. The functions below change the search and replace text. Matches can
 * span bold or italic parts, because every paragraph is searched as a whole.
 */

interface Range {
  from: number
  to: number
}

export interface SearchState {
  term: string
  caseSensitive: boolean
  matches: Range[]
  /** Index of the highlighted match, -1 if there is none. */
  current: number
  decorations: DecorationSet
}

interface SearchMeta {
  term?: string
  caseSensitive?: boolean
  current?: number
}

const searchKey = new PluginKey<SearchState>('glyphSearch')

function findMatches(doc: ProseMirrorNode, term: string, caseSensitive: boolean): Range[] {
  if (!term) return []
  const needle = caseSensitive ? term : term.toLocaleLowerCase('de-DE')
  const matches: Range[] = []

  doc.descendants((block, blockPos) => {
    if (!block.isTextblock) return true
    // Text of the paragraph plus the document position of every character.
    let text = ''
    const positions: number[] = []
    block.descendants((child, childPos) => {
      const start = blockPos + 1 + childPos
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i++) positions.push(start + i)
        text += child.text
      } else if (child.isLeaf) {
        positions.push(start)
        text += '￼' // placeholder for line breaks and other inline nodes
      }
      return true
    })
    const haystack = caseSensitive ? text : text.toLocaleLowerCase('de-DE')
    let index = haystack.indexOf(needle)
    while (index !== -1) {
      matches.push({ from: positions[index]!, to: positions[index + needle.length - 1]! + 1 })
      index = haystack.indexOf(needle, index + needle.length)
    }
    return false
  })
  return matches
}

function buildDecorations(doc: ProseMirrorNode, matches: Range[], current: number): DecorationSet {
  return DecorationSet.create(
    doc,
    matches.map((match, index) =>
      Decoration.inline(match.from, match.to, {
        class: index === current ? 'search-match is-current' : 'search-match'
      })
    )
  )
}

function emptyState(): SearchState {
  return { term: '', caseSensitive: false, matches: [], current: -1, decorations: DecorationSet.empty }
}

export const SearchReplace = Extension.create({
  name: 'searchReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: emptyState,
          apply(tr: Transaction, previous: SearchState): SearchState {
            const meta = tr.getMeta(searchKey) as SearchMeta | undefined
            if (!meta && !tr.docChanged) return previous
            const term = meta?.term ?? previous.term
            const caseSensitive = meta?.caseSensitive ?? previous.caseSensitive
            const matches = findMatches(tr.doc, term, caseSensitive)
            let current = meta?.current ?? previous.current
            if (matches.length === 0) current = -1
            else if (current < 0 || current >= matches.length) current = 0
            return { term, caseSensitive, matches, current, decorations: buildDecorations(tr.doc, matches, current) }
          }
        },
        props: {
          decorations(state) {
            return searchKey.getState(state)?.decorations
          }
        }
      })
    ]
  }
})

export function getSearchState(editor: Editor): SearchState {
  return searchKey.getState(editor.state) ?? emptyState()
}

function dispatchMeta(editor: Editor, meta: SearchMeta): void {
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, meta))
}

/** Scrolls the highlighted match into the middle of the screen. */
function revealCurrent(editor: Editor): void {
  const { matches, current } = getSearchState(editor)
  const match = matches[current]
  if (!match) return
  const { node } = editor.view.domAtPos(match.from)
  const element = node instanceof Element ? node : node.parentElement
  element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export function setSearch(editor: Editor, term: string, caseSensitive: boolean): void {
  // Start at the first match after the cursor, like other word processors.
  const cursor = editor.state.selection.from
  const matches = findMatches(editor.state.doc, term, caseSensitive)
  const after = matches.findIndex((match) => match.from >= cursor)
  dispatchMeta(editor, { term, caseSensitive, current: after === -1 ? 0 : after })
  revealCurrent(editor)
}

export function clearSearch(editor: Editor): void {
  dispatchMeta(editor, { term: '', current: -1 })
}

export function goToMatch(editor: Editor, direction: 1 | -1): void {
  const { matches, current } = getSearchState(editor)
  if (matches.length === 0) return
  const next = (current + direction + matches.length) % matches.length
  const match = matches[next]!
  const tr = editor.state.tr
    .setSelection(TextSelection.create(editor.state.doc, match.from, match.to))
    .setMeta(searchKey, { current: next })
  editor.view.dispatch(tr)
  revealCurrent(editor)
}

/** Replaces the highlighted match and moves on to the next one. */
export function replaceCurrent(editor: Editor, replacement: string): void {
  const { matches, current } = getSearchState(editor)
  const match = matches[current]
  if (!match) return
  // insertText keeps the formatting (bold, color, ...) of the replaced text.
  editor.view.dispatch(editor.state.tr.insertText(replacement, match.from, match.to).setMeta(searchKey, { current }))
  revealCurrent(editor)
}

/** Replaces every match in one step, so one "Rückgängig" undoes all. */
export function replaceAll(editor: Editor, replacement: string): number {
  const { matches } = getSearchState(editor)
  if (matches.length === 0) return 0
  const tr = editor.state.tr
  // Back to front, so earlier positions stay valid.
  for (const match of [...matches].reverse()) tr.insertText(replacement, match.from, match.to)
  editor.view.dispatch(tr)
  return matches.length
}
