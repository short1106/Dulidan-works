import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { GlyphLogo } from '@dulidan/design-system'
import { AUTOSAVE_INTERVAL_MS, clampZoom } from '@dulidan/core'
import { ACTIONS, type ActionId } from '../actions'
import { LinkDialog } from '../dialogs/LinkDialog'
import { RecoveryDialog } from '../dialogs/RecoveryDialog'
import { VersionsDialog } from '../dialogs/VersionsDialog'
import { createExtensions } from '../editor/extensions'
import { ACCEPTED_IMAGE_TYPES, imageFileToDataUrl } from '../editor/images'
import { t } from '../i18n'
import {
  attachEditor,
  confirmLeave,
  documentTitle,
  handleCloseRequest,
  markChanged,
  showOpenedDocument,
  snapshotIfChanged,
  useSession
} from '../state/document'
import { notify } from '../state/notices'
import { settingsStore, useMode, useSettings } from '../state/settings'
import { setUi, useUi } from '../state/ui'
import type { RecoverableEntry } from '../../../shared/ipc'
import { AppMenuBar, changeZoom, ZOOM_STEP } from './AppMenuBar'
import { AprilPanel } from './AprilPanel'
import { BasicToolbar } from './BasicToolbar'
import { ExpertToolbar } from './ExpertToolbar'
import { FindPanel } from './FindPanel'
import { StatusBar } from './StatusBar'

/** Inserts pasted or dropped image files into the editor. */
function insertImageFiles(editor: Editor, files: FileList | undefined | null, position?: number): boolean {
  const images = Array.from(files ?? []).filter((file) => ACCEPTED_IMAGE_TYPES.includes(file.type))
  if (images.length === 0) return false
  for (const file of images) {
    imageFileToDataUrl(file)
      .then((src) => {
        const chain = editor.chain().focus()
        if (position !== undefined) chain.insertContentAt(position, { type: 'image', attrs: { src } }).run()
        else chain.setImage({ src }).run()
      })
      .catch(() => notify(t.errors.imageFailed, 'error'))
  }
  return true
}

/** App-wide keyboard shortcuts. Text formatting keys are handled by the editor itself. */
function useShortcuts(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return
    const handler = (event: KeyboardEvent): void => {
      const mod = navigator.userAgent.includes('Mac') ? event.metaKey : event.ctrlKey
      if (!mod || event.altKey) return
      const key = event.key.toLowerCase()
      const mode = settingsStore.get().mode ?? 'basic'
      const run = (id: ActionId): void => {
        if (!ACTIONS[id].modes.includes(mode)) return
        event.preventDefault()
        ACTIONS[id].run(editor)
      }
      const zoom = settingsStore.get().zoom
      switch (key) {
        case 'n': return run('new')
        case 'o': return run('open')
        case 's': return run(event.shiftKey ? 'saveAs' : 'save')
        case 'p': return run(event.shiftKey ? 'pdf' : 'print')
        case 'f': return run('find')
        case 'k': return run('link')
        case 'h':
          if (mode === 'basic') return
          event.preventDefault()
          setUi({ findOpen: true, findWithReplace: true })
          return
        case '+':
        case '=':
          event.preventDefault()
          return changeZoom(zoom, ZOOM_STEP)
        case '-':
          event.preventDefault()
          return changeZoom(zoom, -ZOOM_STEP)
        case '0':
          event.preventDefault()
          return changeZoom(zoom, 'reset')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editor])
}

let startupTasksDone = false

interface Props {
  /** False while the start animation runs; startup questions wait for it. */
  active: boolean
}

/** The main screen: toolbar, page, status bar, and in pro mode April. */
export function Workspace({ active }: Props): React.JSX.Element {
  const mode = useMode()
  const settings = useSettings()
  const session = useSession()
  const ui = useUi()
  const [recoverable, setRecoverable] = useState<RecoverableEntry[]>([])
  const extensions = useMemo(() => createExtensions(), [])
  // The paste and drop handlers below need the editor, which exists only after creation.
  const editorRef = useRef<Editor | null>(null)

  const editor = useEditor({
    extensions,
    content: '<p></p>',
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'page__content', 'aria-label': t.editor.label, spellcheck: 'true', lang: 'de' },
      handlePaste: (_view, event) =>
        editorRef.current ? insertImageFiles(editorRef.current, event.clipboardData?.files) : false,
      handleDrop: (view, event) => {
        if (!editorRef.current || !event.dataTransfer?.files.length) return false
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        const handled = insertImageFiles(editorRef.current, event.dataTransfer.files, position)
        if (handled) event.preventDefault()
        return handled
      }
    },
    onUpdate: () => markChanged()
  })
  useEffect(() => {
    editorRef.current = editor
    attachEditor(editor)
    return () => attachEditor(null)
  }, [editor])

  useShortcuts(editor)

  // Window title and the "unsaved changes" flag for the close button.
  useEffect(() => {
    document.title = t.app.windowTitle(documentTitle(session), session.dirty)
    window.glyph.window.setDirty(session.dirty)
  }, [session])

  // Autosave every 30 seconds into the recovery folder.
  useEffect(() => {
    const timer = setInterval(() => void snapshotIfChanged(), AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  // Closing the window with unsaved changes asks first.
  useEffect(() => window.glyph.window.onCloseRequested(() => void handleCloseRequest()), [])

  // A .glyph file double-clicked while Glyph is open.
  useEffect(
    () =>
      window.glyph.file.onOpenRequested(async (result) => {
        if (await confirmLeave()) showOpenedDocument(result)
      }),
    []
  )

  // After the start animation: open a file passed at startup, offer recovery.
  useEffect(() => {
    if (!active || !editor || startupTasksDone) return
    // Runs once per app start (React may call effects twice in development).
    startupTasksDone = true
    void (async () => {
      const launched = await window.glyph.file.takeLaunchFile()
      if (launched) showOpenedDocument(launched)
      setRecoverable(await window.glyph.recovery.check())
    })()
  }, [active, editor])

  if (!editor) return <div className="workspace" />

  return (
    <div className={`workspace workspace--${mode}`}>
      <header className="topbar">
        <div className="topbar__brand">
          <GlyphLogo size={mode === 'basic' ? 34 : 26} title="" />
          <span className="topbar__name">{t.app.name}</span>
        </div>
        {mode !== 'basic' && <AppMenuBar editor={editor} />}
        <div className="topbar__title" title={session.location?.filePath}>
          <span className="topbar__doc">{documentTitle(session)}</span>
          {session.dirty && <span className="topbar__dirty" aria-label={t.status.unsaved} />}
        </div>
      </header>

      {mode === 'basic' ? <BasicToolbar editor={editor} /> : <ExpertToolbar editor={editor} />}

      {ui.findOpen && mode !== 'basic' && <FindPanel editor={editor} focusReplace={ui.findWithReplace} />}

      <div className="workspace__body">
        <div
          className="page-scroller"
          onWheel={(event) => {
            // Ctrl + mouse wheel zooms, like in other programs.
            if (!event.ctrlKey) return
            changeZoom(settings.zoom, event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
          }}
        >
          <div
            className="page"
            style={{ zoom: clampZoom(settings.zoom) / 100 }}
            onClick={(event) => {
              // A click on the empty paper margin puts the cursor at the end.
              if (event.target === event.currentTarget) editor.commands.focus('end')
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
        {mode === 'pro' && <AprilPanel />}
      </div>

      <StatusBar editor={editor} />

      <LinkDialog editor={editor} />
      <VersionsDialog />
      <RecoveryDialog entries={recoverable} onChange={setRecoverable} />
    </div>
  )
}
