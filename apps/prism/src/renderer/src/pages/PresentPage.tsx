import { useEffect, useState } from 'react'
import { Button } from '@dulidan/design-system'
import { SlideView } from '../components/SlideView'
import { de as t } from '../i18n/de'
import { useDeckState } from '../state/deck'

/**
 * Full screen presentation. Arrow keys, space or a click go forward,
 * Esc leaves the view.
 */
export function PresentPage({ onExit }: { onExit: () => void }): React.JSX.Element {
  const { deck } = useDeckState()
  const [index, setIndex] = useState(0)
  const last = deck.slides.length - 1
  const slide = deck.slides[Math.min(index, last)]

  useEffect(() => {
    void document.documentElement.requestFullscreen?.().catch(() => undefined)
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onExit()
      else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) setIndex((i) => Math.min(i + 1, last))
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, onExit])

  if (!slide) return <p>{t.editor.empty}</p>

  return (
    <div className="prism-present" onClick={() => setIndex((i) => Math.min(i + 1, last))}>
      <SlideView slide={slide} number={index + 1} />
      <div className="prism-present-bar" onClick={(event) => event.stopPropagation()}>
        <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => Math.max(i - 1, 0))}>
          {t.present.previous}
        </Button>
        <span>{t.editor.slideNumber(index + 1, deck.slides.length)}</span>
        <Button variant="ghost" disabled={index === last} onClick={() => setIndex((i) => Math.min(i + 1, last))}>
          {t.present.next}
        </Button>
        <Button variant="ghost" onClick={onExit}>
          {t.present.exit}
        </Button>
      </div>
    </div>
  )
}
