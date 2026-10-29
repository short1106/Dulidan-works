import { useEffect } from 'react'
import { FileUp, LayoutGrid, List, Plus, Settings, Trash2 } from 'lucide-react'
import { Button, DulidanMark, IconButton, notify, Toolbar } from '@dulidan/design-system'
import { can } from '../features'
import { shortcut, t } from '../i18n'
import { createNote, saveNow, useNote } from '../state/note'
import { errorText, folderForNewNote, refreshLists, showView, useNotes } from '../state/notes'
import { updatePrefs, useMode, usePrefs } from '../state/settings'
import { focusSearch, setUi } from '../state/ui'
import { CardGrid, NoteList, SearchField } from './NoteItems'
import { NoteView } from './NoteView'
import { Sidebar } from './Sidebar'
import { TrashView } from './TrashView'

/** Strg+N new note, Strg+F search, Strg+S save now. */
function useShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (document.querySelector('dialog[open]')) return
      const mod = navigator.userAgent.includes('Mac') ? event.metaKey : event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 'n') {
        event.preventDefault()
        void createNote()
      } else if (key === 'f') {
        event.preventDefault()
        focusSearch()
      } else if (key === 's') {
        event.preventDefault()
        void saveNow()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

async function importNotes(): Promise<void> {
  const result = await window.cortex.exports.importFiles(folderForNewNote())
  if (!result.ok) return notify(errorText(result.error), 'error')
  if (result.value.length === 0) return
  notify(t.importExport.imported(result.value.length), 'success')
  await refreshLists()
}

function Brand(): React.JSX.Element {
  return (
    <div className="topbar__brand">
      <DulidanMark size={30} tile title="" />
      <span className="topbar__name">{t.app.name}</span>
    </div>
  )
}

/** Basic mode: big buttons, colorful cards, one note at a time. */
function BasicWorkspace(): React.JSX.Element {
  const { items, view, query, loading } = useNotes()
  const { current } = useNote()

  if (current) {
    return (
      <main className="workspace__main workspace__main--basic">
        <NoteView />
      </main>
    )
  }
  if (view.kind === 'trash') {
    return (
      <main className="workspace__main workspace__main--basic">
        <TrashView />
      </main>
    )
  }
  return (
    <main className="workspace__main workspace__main--basic">
      <div className="basic-home">
        <div className="basic-home__actions">
          <Button variant="primary" className="basic-home__new" icon={<Plus />} onClick={() => void createNote()}>
            {t.nav.newNote}
          </Button>
          <SearchField large />
        </div>
        {!loading && <CardGrid colorful items={items} selected={null} emptyText={query ? t.list.noResults : t.list.emptyBasic} />}
      </div>
    </main>
  )
}

function ExpertWorkspace(): React.JSX.Element {
  const { items, view, query, loading } = useNotes()
  const { current } = useNote()
  const prefs = usePrefs()
  const cards = prefs.layout === 'cards'
  return (
    <div className="workspace__body">
      <Sidebar />
      {view.kind === 'trash' ? (
        <main className="workspace__main">
          <TrashView />
        </main>
      ) : (
        <>
          <section className={cards ? 'list-pane list-pane--cards' : 'list-pane'} aria-label={t.list.label}>
            {query && !loading && <p className="list-pane__info">{t.list.searchResults(items.length)}</p>}
            {!loading &&
              (cards ? (
                <CardGrid items={items} selected={current?.path ?? null} emptyText={query ? t.list.noResults : t.list.empty} />
              ) : (
                <NoteList items={items} selected={current?.path ?? null} emptyText={query ? t.list.noResults : t.list.empty} showFolder={view.kind !== 'folder'} />
              ))}
          </section>
          <main className="workspace__main">
            <NoteView />
          </main>
        </>
      )}
    </div>
  )
}

/** The main screen: top bar, then the mode's layout. */
export function Workspace(): React.JSX.Element {
  const mode = useMode()
  const basic = mode === 'basic'
  const prefs = usePrefs()
  const { current } = useNote()
  useShortcuts()

  useEffect(() => {
    document.title = t.app.windowTitle(current?.meta.title ?? null)
  }, [current?.meta.title])

  return (
    <div className={basic ? 'workspace workspace--basic' : 'workspace'}>
      <header className="topbar">
        <Brand />
        {!basic && <SearchField />}
        <span className="toolbar__spacer" />
        <Toolbar label={t.nav.label} className="topbar__actions">
          {!basic && (
            <IconButton icon={<Plus />} label={t.nav.newNote} shortcut={shortcut('N')} showLabel onClick={() => void createNote()} />
          )}
          {can('listLayout', mode) && (
            <IconButton
              icon={prefs.layout === 'cards' ? <List /> : <LayoutGrid />}
              label={prefs.layout === 'cards' ? t.nav.layoutList : t.nav.layoutCards}
              onClick={() => void updatePrefs({ layout: prefs.layout === 'cards' ? 'list' : 'cards' })}
            />
          )}
          {can('import', mode) && <IconButton icon={<FileUp />} label={t.nav.import} onClick={() => void importNotes()} />}
          {basic && <IconButton icon={<Trash2 />} label={t.nav.trash} showLabel onClick={() => showView({ kind: 'trash' })} />}
          <IconButton icon={<Settings />} label={t.nav.settings} showLabel={basic} onClick={() => setUi({ settingsOpen: true })} />
        </Toolbar>
      </header>
      {basic ? <BasicWorkspace /> : <ExpertWorkspace />}
    </div>
  )
}
