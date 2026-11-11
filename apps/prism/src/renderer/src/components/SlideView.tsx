import type { CSSProperties } from 'react'
import { bodyLines, slideColors, THEMES, type Deck, type Slide } from '../../../main/deck'

/**
 * One slide on the 16:9 canvas, in the colors of the design (or the slide's
 * own color) and with its picture. Used in the editor, in the presentation
 * and in the PDF.
 */
export function SlideView({ slide, deck, number }: { slide: Slide; deck: Pick<Deck, 'theme'>; number?: number }): React.JSX.Element {
  const lines = bodyLines(slide.body)
  const colors = slideColors(deck, slide)
  const theme = THEMES[deck.theme] ?? THEMES.nacht
  const style = {
    '--slide-bg': colors.background,
    '--slide-text': colors.text,
    '--slide-accent': colors.accent,
    '--slide-border': slide.background ? colors.accent : theme.border
  } as CSSProperties
  const image = slide.image
  const classes = ['prism-slide', `prism-slide-${slide.layout}`, image ? `prism-has-image prism-image-${image.placement}` : ''].filter(Boolean).join(' ')
  const text =
    lines.length > 0 ? (
      <ul className="prism-slide-body">
        {lines.map((line, index) => (
          <li key={index} className={line.bullet ? 'prism-bullet' : 'prism-plain'}>
            {line.text}
          </li>
        ))}
      </ul>
    ) : null
  return (
    <div className={classes} style={style} aria-label={number ? `Folie ${number}` : undefined}>
      <h2 className="prism-slide-title">{slide.title || ' '}</h2>
      {image ? (
        <div className="prism-slide-content">
          {text && <div className="prism-slide-text">{text}</div>}
          <img className="prism-slide-image" src={image.src} alt={image.alt} />
        </div>
      ) : (
        text
      )}
      {number !== undefined && <span className="prism-slide-number">{number}</span>}
    </div>
  )
}
