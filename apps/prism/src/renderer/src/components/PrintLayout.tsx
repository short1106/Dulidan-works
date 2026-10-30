import type { Deck } from '../../../main/deck'
import { SlideView } from './SlideView'

/** All slides one after another, each on its own page. Shown only while the PDF is made. */
export function PrintLayout({ deck }: { deck: Deck }): React.JSX.Element {
  return (
    <div className="prism-print">
      {deck.slides.map((slide, index) => (
        <div key={slide.id} className="prism-print-page">
          <SlideView slide={slide} number={index + 1} />
        </div>
      ))}
    </div>
  )
}
