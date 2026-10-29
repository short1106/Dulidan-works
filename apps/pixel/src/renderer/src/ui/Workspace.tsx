import { useEffect, useState } from 'react'
import { DulidanMark } from '@dulidan/design-system'
import { AUTOSAVE_INTERVAL_MS, filterByMode, isAvailableIn } from '@dulidan/core'
import { getDoc, redo, undo } from '../engine/document'
import { addLayer } from '../engine/layers'
import { t } from '../i18n'
import { RecoveryDialog } from '../dialogs/RecoveryDialog'
import { NewCanvasDialog } from '../dialogs/NewCanvasDialog'
import { ResizeDialog } from '../dialogs/ResizeDialog'
import {
  confirmLeave,
  exportImage,
  handleCloseRequest,
  openWithDialog,
  saveAsImage,
  saveProject,
  sessionTitle,
  showOpened,
  snapshotIfChanged,
  startBlank,
  useSession
} from '../state/session'
import { currentMode, useMode } from '../state/settings'
import { changeSize, setTool } from '../state/tools'
import { setUi } from '../state/ui'
import { actualSize, fitToView, zoomStep } from '../state/viewport'
import { FEATURES, TOOLS } from '../tools'
import { textEditStore } from '../tools/controller'
import { CanvasView } from '../view/CanvasView'
import { AppMenuBar } from './AppMenuBar'
import { AprilPanel } from './AprilPanel'
import { ColorPicker } from './ColorPicker'
import { LayersPanel } from './LayersPanel'
import { OptionsBar } from './OptionsBar'
import { StatusBar } from './StatusBar'
import { BasicToolbar, ToolColumn } from './Toolbars'
import type { RecoverableEntry } from '../../../shared/ipc'

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

/** Keyboard shortcuts of Pixel. Tool keys work without Strg. */
function useShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (isTyping(event.target) || textEditStore.get()) return
      // A dialog is open: leave the keys to it.
      if (document.querySelector('dialog[open]')) return
      const mode = currentMode()
      const mod = navigator.userAgent.includes('Mac') ? event.metaKey : event.ctrlKey
      const key = event.key.toLowerCase()
      const handled = (): void => event.preventDefault()

      if (mod && !event.altKey) {
        if (key === 'z' && !event.shiftKey) return handled(), undo()
        if ((key === 'y' || (key === 'z' && event.shiftKey)) && isAvailableIn(FEATURES.redo, mode)) return handled(), redo()
        if (key === 's') return handled(), void (event.shiftKey && mode !== 'basic' ? saveProject(true) : saveProject())
        if (key === 'o' && mode !== 'basic') return handled(), void openWithDialog()
        if (key === 'n' && event.shiftKey && isAvailableIn(FEATURES.layers, mode)) return handled(), addLayer()
        if (key === 'n' && mode !== 'basic') return handled(), setUi({ newOpen: true })
        if (key === 'e' && event.shiftKey) return handled(), void (mode === 'basic' ? saveAsImage() : exportImage('png'))
        if (key === '+' || key === '=') return handled(), zoomStep(1)
        if (key === '-') return handled(), zoomStep(-1)
        if (key === '0') return handled(), fitToView(getDoc().width, getDoc().height)
        if (key === '1') return handled(), actualSize(getDoc().width, getDoc().height)
        return
      }
      if (event.altKey || mod) return
      if (key === '[') return handled(), changeSize(1 / 1.2)
      if (key === ']') return handled(), changeSize(1.2)
      const tool = filterByMode(TOOLS, mode).find((item) => item.key.toLowerCase() === key)
      if (tool) {
        handled()
        setTool(tool.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

let startupTasksDone = false

interface Props {
  /** False while the start animation runs; startup questions wait for it. */
  active: boolean
}

/** The main screen of Pixel. Which parts are shown depends on the mode. */
export function Workspace({ active }: Props): React.JSX.Element {
  const mode = useMode()
  const session = useSession()
  const [recoverable, setRecoverable] = useState<RecoverableEntry[]>([])

  useShortcuts()

  useEffect(() => {
    document.title = t.app.windowTitle(sessionTitle(session), session.dirty)
    window.pixel.window.setDirty(session.dirty)
  }, [session])

  useEffect(() => {
    const timer = setInterval(() => void snapshotIfChanged(), AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => window.pixel.window.onCloseRequested(() => void handleCloseRequest()), [])
  useEffect(
    () =>
      window.pixel.file.onOpenRequested(async (result) => {
        if (await confirmLeave()) await showOpened(result)
      }),
    []
  )

  // After the start animation: open a file passed at startup, offer recovery.
  useEffect(() => {
    if (!active || startupTasksDone) return
    startupTasksDone = true
    void (async () => {
      const launched = await window.pixel.file.takeLaunchFile()
      if (launched) await showOpened(launched)
      setRecoverable(await window.pixel.recovery.check())
    })()
  }, [active])

  const advanced = isAvailableIn(FEATURES.layers, mode)

  return (
    <div className={`workspace workspace--${mode}`}>
      <header className="topbar">
        <div className="topbar__brand">
          <DulidanMark size={mode === 'basic' ? 34 : 26} tile title="" />
          <span className="topbar__name">{t.app.name}</span>
        </div>
        {isAvailableIn(FEATURES.menuBar, mode) && <AppMenuBar />}
        <div className="topbar__title" title={session.location?.filePath}>
          <span className="topbar__doc">{sessionTitle(session)}</span>
          {session.dirty && <span className="topbar__dirty" aria-label={t.status.unsaved} />}
        </div>
      </header>

      {mode === 'basic' && <BasicToolbar />}
      <OptionsBar />

      <div className="workspace__body">
        {advanced && <ToolColumn />}
        <CanvasView />
        {advanced && (
          <aside className="sidebar">
            <section className="panel" aria-labelledby="color-title">
              <h2 id="color-title" className="panel__title">
                {t.color.label}
              </h2>
              <ColorPicker />
            </section>
            <LayersPanel />
            {isAvailableIn(FEATURES.april, mode) && <AprilPanel />}
          </aside>
        )}
      </div>

      <StatusBar />
      <NewCanvasDialog />
      <ResizeDialog />
      <RecoveryDialog entries={recoverable} onChange={setRecoverable} />
    </div>
  )
}

/** Creates the first blank picture once at app start. */
export function ensureStartPicture(): void {
  if (getDoc().layers.length === 0) startBlank()
}
