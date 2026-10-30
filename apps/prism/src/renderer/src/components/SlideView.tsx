import { bodyLines, type Slide } from '../../../main/deck'

/** One slide on the 16:9 canvas. Used in the editor, in the presentation and in the PDF. */
export function SlideView({ slide, number }: { slide: Slide; number?: number }): React.JSX.Element {
  const lines = bodyLines(slide.body)
  return (
    <div className={`prism-slide prism-slide-${slide.layout}`} aria-label={number ? `Folie ${number}` : undefined}>
      <h2 className="prism-slide-title">{slide.title || ' '}</h2>
      {lines.length > 0 && (
        <ul className="prism-slide-body">
          {lines.map((line, index) => (
            <li key={index} className={line.bullet ? 'prism-bullet' : 'prism-plain'}>
              {line.text}
            </li>
          ))}
        </ul>
      )}
      {number !== undefined && <span className="prism-slide-number">{number}</span>}
    </div>
  )
}
