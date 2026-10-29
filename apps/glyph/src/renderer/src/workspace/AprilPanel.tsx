import { Sparkles } from 'lucide-react'
import { CornerBrackets } from '@dulidan/design-system'
import { t } from '../i18n'

/** Pro mode: side panel for April. Version 1 is a disabled placeholder. */
export function AprilPanel(): React.JSX.Element {
  return (
    <aside className="april-panel" aria-label={t.april.title}>
      <CornerBrackets />
      <header className="april-panel__head">
        <Sparkles aria-hidden="true" />
        <h2>{t.april.title}</h2>
        <span className="april-panel__badge">{t.april.comingSoon}</span>
      </header>
      <p className="april-panel__text">{t.april.text}</p>
      <textarea className="april-panel__input" placeholder={t.april.inputPlaceholder} disabled aria-disabled="true" rows={3} />
    </aside>
  )
}
