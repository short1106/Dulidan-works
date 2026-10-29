import { Eraser, Sparkles, ZoomIn } from 'lucide-react'
import { Button } from '@dulidan/design-system'
import { t } from '../i18n'

/** Pro mode: placeholder for April, the AI helper. Everything is disabled in version 1. */
export function AprilPanel(): React.JSX.Element {
  return (
    <section className="panel april-panel" aria-labelledby="april-title">
      <header className="april-panel__head">
        <Sparkles aria-hidden="true" />
        <h2 id="april-title" className="panel__title">
          {t.april.title}
        </h2>
        <span className="april-panel__badge">{t.april.comingSoon}</span>
      </header>
      <p className="april-panel__text">{t.april.text}</p>
      <div className="april-panel__actions">
        <Button icon={<Eraser />} disabled>
          {t.april.removeBackground}
        </Button>
        <Button icon={<ZoomIn />} disabled>
          {t.april.upscale}
        </Button>
      </div>
    </section>
  )
}
