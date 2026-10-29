import { Briefcase, Feather, Sparkles, type LucideIcon } from 'lucide-react'
import { CornerBrackets, GlyphLogo } from '@dulidan/design-system'
import type { Mode } from '@dulidan/core'
import { t } from '../i18n'
import './mode-chooser.css'

export const MODE_CARDS: Array<{ mode: Mode; icon: LucideIcon; name: string; text: string }> = [
  { mode: 'basic', icon: Feather, name: t.modes.basic.name, text: t.modes.basic.text },
  { mode: 'expert', icon: Briefcase, name: t.modes.expert.name, text: t.modes.expert.text },
  { mode: 'pro', icon: Sparkles, name: t.modes.pro.name, text: t.modes.pro.text }
]

interface Props {
  onChoose: (mode: Mode) => void
}

/** First start: "Wie möchtest du arbeiten?" with three big cards. */
export function ModeChooser({ onChoose }: Props): React.JSX.Element {
  return (
    <main className="chooser">
      <div className="chooser__head">
        <GlyphLogo size={56} title="" />
        <h1 className="chooser__title">{t.modes.chooserTitle}</h1>
        <p className="chooser__text">{t.modes.chooserText}</p>
      </div>
      <div className="chooser__cards">
        {MODE_CARDS.map(({ mode, icon: Icon, name, text }, index) => (
          <button
            key={mode}
            type="button"
            className="chooser__card"
            style={{ animationDelay: `${index * 90}ms` }}
            onClick={() => onChoose(mode)}
            autoFocus={index === 0}
          >
            <CornerBrackets />
            <span className="chooser__scan" aria-hidden="true" />
            <Icon className="chooser__icon" aria-hidden="true" />
            <span className="chooser__name">{name}</span>
            <span className="chooser__desc">{text}</span>
            <span className="chooser__choose">{t.modes.choose}</span>
          </button>
        ))}
      </div>
    </main>
  )
}
