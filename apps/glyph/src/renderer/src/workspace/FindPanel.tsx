import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button, IconButton } from '@dulidan/design-system'
import { clearSearch, getSearchState, goToMatch, replaceAll, replaceCurrent, setSearch } from '../editor/searchReplace'
import { t } from '../i18n'
import { notify } from '../state/notices'
import { setUi } from '../state/ui'

interface Props {
  editor: Editor
  focusReplace: boolean
}

/** The find and replace bar above the document. */
export function FindPanel({ editor, focusReplace }: Props): React.JSX.Element {
  const [term, setTerm] = useState(() => {
    // Selected text is the natural thing to search for.
    const { from, to } = editor.state.selection
    return from === to ? getSearchState(editor).term : editor.state.doc.textBetween(from, to, ' ').slice(0, 100)
  })
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const findRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)

  const { current, total } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const state = e ? getSearchState(e) : null
      return { current: state ? state.current + 1 : 0, total: state?.matches.length ?? 0 }
    }
  })

  useEffect(() => {
    setSearch(editor, term, caseSensitive)
  }, [editor, term, caseSensitive])

  useEffect(() => {
    const target = focusReplace ? replaceRef.current : findRef.current
    target?.focus()
    target?.select()
  }, [focusReplace])

  // Remove the highlights when the panel closes.
  useEffect(() => () => clearSearch(editor), [editor])

  const close = (): void => {
    setUi({ findOpen: false })
    editor.commands.focus()
  }

  return (
    <div
      className="find-panel"
      role="search"
      aria-label={t.find.title}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          close()
        }
      }}
    >
      <div className="find-panel__row">
        <input
          ref={findRef}
          className="find-panel__input"
          aria-label={t.find.find}
          placeholder={t.find.find}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              goToMatch(editor, event.shiftKey ? -1 : 1)
            }
          }}
        />
        <span className="find-panel__count" aria-live="polite">
          {term ? t.find.results(current, total) : ''}
        </span>
        <IconButton icon={<ChevronUp />} label={t.find.previous} disabled={total === 0} onClick={() => goToMatch(editor, -1)} />
        <IconButton icon={<ChevronDown />} label={t.find.next} disabled={total === 0} onClick={() => goToMatch(editor, 1)} />
        <label className="find-panel__check">
          <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
          {t.find.matchCase}
        </label>
        <IconButton icon={<X />} label={t.find.close} onClick={close} className="find-panel__close" />
      </div>
      <div className="find-panel__row">
        <input
          ref={replaceRef}
          className="find-panel__input"
          aria-label={t.find.replace}
          placeholder={t.find.replace}
          value={replacement}
          onChange={(event) => setReplacement(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              replaceCurrent(editor, replacement)
            }
          }}
        />
        <Button disabled={total === 0} onClick={() => replaceCurrent(editor, replacement)}>
          {t.find.replaceOne}
        </Button>
        <Button
          disabled={total === 0}
          onClick={() => {
            const count = replaceAll(editor, replacement)
            notify(t.find.replaced(count), 'success')
          }}
        >
          {t.find.replaceAll}
        </Button>
      </div>
    </div>
  )
}
