import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { activeLayer } from '../engine/document'
import { commitText, fontString, LINE_HEIGHT } from '../engine/text'
import { t } from '../i18n'
import { rememberColor } from '../state/settings'
import { useTools } from '../state/tools'
import { useViewport } from '../state/viewport'
import { textEditStore, useTextEdit } from '../tools/controller'

/**
 * The text tool's input field, placed on the picture where the user
 * clicked. "Fertig" or a click elsewhere paints the text, Escape cancels.
 */
export function TextEditor(): React.JSX.Element | null {
  const position = useTextEdit()
  const tools = useTools()
  const view = useViewport()
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!position) return
    setValue('')
    // Focus after the click that opened the field has finished.
    requestAnimationFrame(() => ref.current?.focus())
  }, [position])

  if (!position) return null
  const settings = { ...tools.text, color: tools.color }

  const commit = (): void => {
    const layer = activeLayer()
    if (layer && value.trim()) {
      commitText(layer, position, value, settings, t.history.text)
      rememberColor(tools.color)
    }
    textEditStore.set(null)
  }
  const cancel = (): void => textEditStore.set(null)

  const lines = Math.max(1, value.split('\n').length)
  return (
    <div
      className="text-editor"
      style={{ left: view.x + position.x * view.zoom, top: view.y + position.y * view.zoom }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <textarea
        ref={ref}
        className="text-editor__input"
        aria-label={t.tools.text}
        value={value}
        rows={lines}
        style={{
          font: fontString({ ...settings, size: settings.size * view.zoom }),
          lineHeight: LINE_HEIGHT,
          color: settings.color,
          opacity: settings.opacity,
          minWidth: Math.max(120, settings.size * view.zoom * 4)
        }}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            cancel()
          } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            commit()
          }
        }}
        onBlur={(event) => {
          // Clicking the buttons below must not commit twice.
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) commit()
        }}
      />
      <div className="text-editor__actions">
        <button type="button" className="text-editor__button" onClick={commit}>
          <Check aria-hidden="true" /> {t.options.textDone}
        </button>
        <button type="button" className="text-editor__button" onClick={cancel} aria-label={t.options.cancel}>
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
