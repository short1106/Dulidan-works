import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { CircleCheck, CircleDot, Minus, Plus } from 'lucide-react'
import { IconButton } from '@dulidan/design-system'
import { t } from '../i18n'
import { savePulseStore, useSession } from '../state/document'
import { useMode, useSettings } from '../state/settings'
import { changeZoom, ZOOM_STEP } from './AppMenuBar'

export function StatusBar({ editor }: { editor: Editor }): React.JSX.Element {
  const session = useSession()
  const mode = useMode()
  const { zoom } = useSettings()
  const words = useEditorState({
    editor,
    selector: ({ editor: e }) => (e?.storage.characterCount.words() as number | undefined) ?? 0
  })

  // After saving the check mark pulses once.
  const pulse = useSyncExternalStore(savePulseStore.subscribe, savePulseStore.get)
  const [pulsing, setPulsing] = useState(false)
  useEffect(() => {
    if (pulse === 0) return
    setPulsing(true)
    const timer = setTimeout(() => setPulsing(false), 600)
    return () => clearTimeout(timer)
  }, [pulse])

  return (
    <footer className="status-bar">
      <span className={`status-bar__save ${session.dirty ? 'is-dirty' : 'is-saved'} ${pulsing ? 'is-pulsing' : ''}`}>
        {session.dirty ? <CircleDot aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
        {session.dirty ? t.status.unsaved : t.status.saved}
      </span>
      <span className="status-bar__words">{t.status.words(words)}</span>
      <span className="status-bar__spacer" />
      {mode !== 'basic' && (
        <span className="status-bar__zoom" role="group" aria-label={t.status.zoom}>
          <IconButton icon={<Minus />} label={t.actions.zoomOut} onClick={() => changeZoom(zoom, -ZOOM_STEP)} />
          <button type="button" className="status-bar__zoom-value" title={t.actions.zoomReset} onClick={() => changeZoom(zoom, 'reset')}>
            {zoom} %
          </button>
          <IconButton icon={<Plus />} label={t.actions.zoomIn} onClick={() => changeZoom(zoom, ZOOM_STEP)} />
        </span>
      )}
    </footer>
  )
}
