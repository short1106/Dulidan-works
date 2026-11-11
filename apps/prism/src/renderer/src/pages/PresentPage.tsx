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
  const [direction, setDirection] = useState<'vor' | 'zurueck'>('vor')
  const last = deck.slides.length - 1
  const slide = deck.slides[Math.min(index, last)]
  const go = (step: 1 | -1): void => {
    setDirection(step === 1 ? 'vor' : 'zurueck')
    setIndex((i) => Math.min(Math.max(i + step, 0), last))
  }
  // No movement when the user turned animations off.
  const reduced = document.documentElement.dataset['motion'] === 'reduced'
  const animation = reduced || deck.transition === 'keiner' ? '' : deck.transition === 'blende' ? 'prism-anim-blende' : `prism-anim-schieben-${direction}`

  useEffect(() => {
    void document.documentElement.requestFullscreen?.().catch(() => undefined)
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onExit()
      else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) go(1)
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, onExit])

  if (!slide) return <p>{t.editor.empty}</p>

  return (
    <div className="prism-present" onClick={() => go(1)}>
      <div key={index} className={`prism-present-slide ${animation}`}>
        <SlideView slide={slide} deck={deck} number={index + 1} />
      </div>
      <div className="prism-present-bar" onClick={(event) => event.stopPropagation()}>
        <Button variant="ghost" disabled={index === 0} onClick={() => go(-1)}>
          {t.present.previous}
        </Button>
        <span>{t.editor.slideNumber(index + 1, deck.slides.length)}</span>
        <Button variant="ghost" disabled={index === last} onClick={() => go(1)}>
          {t.present.next}
        </Button>
        <Button variant="ghost" onClick={onExit}>
          {t.present.exit}
        </Button>
      </div>
    </div>
  )
}
