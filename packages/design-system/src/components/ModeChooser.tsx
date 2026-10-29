import type { ReactNode } from 'react'
import { CornerBrackets } from './Card'

export interface ModeCard<M extends string> {
  mode: M
  icon: ReactNode
  name: string
  text: string
}

export interface ModeChooserProps<M extends string> {
  title: string
  text: string
  cards: Array<ModeCard<M>>
  /** Text on the button of each card, e.g. "Auswählen". */
  chooseLabel: string
  logo?: ReactNode
  onChoose: (mode: M) => void
}

/** First start: "Wie möchtest du arbeiten?" with one big card per mode. */
export function ModeChooser<M extends string>({ title, text, cards, chooseLabel, logo, onChoose }: ModeChooserProps<M>): React.JSX.Element {
  return (
    <main className="dd-chooser">
      <div className="dd-chooser__head">
        {logo}
        <h1 className="dd-chooser__title">{title}</h1>
        <p className="dd-chooser__text">{text}</p>
      </div>
      <div className="dd-chooser__cards">
        {cards.map((card, index) => (
          <button
            key={card.mode}
            type="button"
            className="dd-chooser__card"
            style={{ animationDelay: `${index * 90}ms` }}
            onClick={() => onChoose(card.mode)}
            autoFocus={index === 0}
          >
            <CornerBrackets />
            <span className="dd-chooser__scan" aria-hidden="true" />
            <span className="dd-chooser__icon" aria-hidden="true">
              {card.icon}
            </span>
            <span className="dd-chooser__name">{card.name}</span>
            <span className="dd-chooser__desc">{card.text}</span>
            <span className="dd-chooser__choose">{chooseLabel}</span>
          </button>
        ))}
      </div>
    </main>
  )
}
