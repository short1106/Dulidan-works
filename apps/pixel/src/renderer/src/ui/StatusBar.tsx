import { CircleCheck, CircleDot, Maximize, Minus, Plus } from 'lucide-react'
import { IconButton } from '@dulidan/design-system'
import { useDoc } from '../engine/document'
import { t } from '../i18n'
import { useSession } from '../state/session'
import { useMode } from '../state/settings'
import { fitToView, useViewport, zoomStep } from '../state/viewport'
import { usePointerPosition } from '../view/CanvasView'

export function StatusBar(): React.JSX.Element {
  const { doc } = useDoc()
  const session = useSession()
  const view = useViewport()
  const position = usePointerPosition()
  const mode = useMode()
  return (
    <footer className="status-bar">
      <span className={`status-bar__save ${session.dirty ? 'is-dirty' : 'is-saved'}`}>
        {session.dirty ? <CircleDot aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
        {session.dirty ? t.status.unsaved : t.status.saved}
      </span>
      <span>{t.status.size(doc.width, doc.height)}</span>
      {mode !== 'basic' && position && <span>{t.status.position(position.x, position.y)}</span>}
      <span className="status-bar__hint">{t.status.panHint}</span>
      <span className="status-bar__spacer" />
      <span className="status-bar__zoom" role="group" aria-label={t.status.zoom}>
        <IconButton icon={<Minus />} label={t.actions.zoomOut} onClick={() => zoomStep(-1)} />
        <span className="status-bar__zoom-value">{Math.round(view.zoom * 100)} %</span>
        <IconButton icon={<Plus />} label={t.actions.zoomIn} onClick={() => zoomStep(1)} />
        <IconButton icon={<Maximize />} label={t.actions.zoomFit} onClick={() => fitToView(doc.width, doc.height)} />
      </span>
    </footer>
  )
}
