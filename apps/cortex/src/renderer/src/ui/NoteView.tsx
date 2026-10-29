import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, FileDown, FileText, FolderInput, MoreHorizontal, Palette, Pin, PinOff, Sparkles, Trash2, X } from 'lucide-react'
import { Button, cx, DropdownMenu, IconButton, notify } from '@dulidan/design-system'
import { normalizeTag, NOTE_COLORS, type NoteColor } from '@dulidan/notes-core'
import type { OpenedNote } from '../../../shared/ipc'
import { NoteEditor } from '../editor/NoteEditor'
import { can } from '../features'
import { t } from '../i18n'
import { closeNote, currentHtml, openNote, renameCurrent, setColor, setPinned, setTags, trashCurrent, useNote } from '../state/note'
import { errorText } from '../state/notes'
import { useMode } from '../state/settings'
import { setUi } from '../state/ui'
import { shortDate } from './NoteItems'

const savedTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

function TitleField({ note, focus }: { note: OpenedNote; focus: boolean }): React.JSX.Element {
  const [value, setValue] = useState(note.meta.title)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => setValue(note.meta.title), [note.meta.title, note.path])
  useEffect(() => {
    if (!focus) return
    ref.current?.focus()
    ref.current?.select()
  }, [focus, note.path])
  return (
    <input
      ref={ref}
      className="note-view__title"
      aria-label={t.note.titleLabel}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void renameCurrent(value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          // Straight on to the text; renaming happens meanwhile (blur).
          document.querySelector<HTMLElement>('.note-editor__content')?.focus()
        } else if (event.key === 'Escape') {
          setValue(note.meta.title)
        }
      }}
    />
  )
}

function TagEditor({ tags }: { tags: string[] }): React.JSX.Element {
  const [value, setValue] = useState('')
  const add = (): void => {
    const tag = normalizeTag(value)
    setValue('')
    if (tag && !tags.includes(tag)) void setTags([...tags, tag])
  }
  return (
    <div className="tag-editor" role="group" aria-label={t.note.tags}>
      {tags.map((tag) => (
        <span key={tag} className="chip chip--tag">
          #{tag}
          <button type="button" className="chip__remove" aria-label={t.note.removeTag(tag)} onClick={() => void setTags(tags.filter((item) => item !== tag))}>
            <X aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        className="tag-editor__input"
        aria-label={t.note.addTag}
        placeholder={t.note.addTag}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            add()
          } else if (event.key === 'Backspace' && !value && tags.length > 0) {
            void setTags(tags.slice(0, -1))
          }
        }}
      />
    </div>
  )
}

function ColorMenu({ color, showLabel }: { color: NoteColor | null; showLabel: boolean }): React.JSX.Element {
  return (
    <DropdownMenu
      label={t.note.color}
      triggerClassName={cx('dd-icon-button', showLabel && 'dd-icon-button--labeled')}
      trigger={
        <>
          <Palette aria-hidden="true" />
          {showLabel && <span className="dd-icon-button__label">{t.note.color}</span>}
        </>
      }
      items={[
        ...NOTE_COLORS.map((value) => ({
          id: value,
          label: t.note.colorNames[value] ?? value,
          checked: color === value,
          icon: <span className={cx('swatch', `swatch--${value}`)} />,
          onSelect: () => void setColor(value)
        })),
        { id: 'none', label: t.note.noColor, checked: color === null, onSelect: () => void setColor(null) }
      ]}
    />
  )
}

function SaveState(): React.JSX.Element {
  const { dirty, saving, savedAt } = useNote()
  const text = saving ? t.note.saving : dirty ? t.note.unsaved : savedAt ? t.note.saved(savedTime.format(savedAt)) : ''
  return (
    <span className="save-state" role="status" aria-live="polite">
      {text}
    </span>
  )
}

async function exportPdf(note: OpenedNote): Promise<void> {
  setUi({ printHtml: { title: note.meta.title, html: currentHtml() } })
  // Let the print sheet render, then the main process makes the PDF.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const result = await window.cortex.exports.pdf(note.meta.title)
  setUi({ printHtml: null })
  if (!result.ok) notify(errorText(result.error), 'error')
  else if (result.value) notify(t.note.exported, 'success')
}

async function exportMarkdown(note: OpenedNote): Promise<void> {
  const result = await window.cortex.exports.markdown(note.path)
  if (!result.ok) notify(errorText(result.error), 'error')
  else if (result.value) notify(t.note.exported, 'success')
}

/** The open note: title, actions, text, links to it. */
export function NoteView(): React.JSX.Element {
  const { current: note, editorKey, backlinks, focusTitle } = useNote()
  const mode = useMode()
  const basic = mode === 'basic'

  if (!note) {
    return (
      <section className="note-view note-view--empty">
        <p>{t.note.select}</p>
      </section>
    )
  }

  const moreItems = [
    ...(can('exportPdf', mode) ? [{ id: 'pdf', label: t.note.exportPdf, icon: <FileDown />, onSelect: () => void exportPdf(note) }] : []),
    ...(can('exportMarkdown', mode) ? [{ id: 'md', label: t.note.exportMarkdown, icon: <FileText />, onSelect: () => void exportMarkdown(note) }] : []),
    ...(can('folders', mode) ? [{ id: 'move', label: t.note.move, icon: <FolderInput />, onSelect: () => setUi({ moveDialog: true }) }] : []),
    { id: 'sep', separator: true as const },
    { id: 'trash', label: t.note.trash, icon: <Trash2 />, onSelect: () => void trashCurrent() }
  ]

  return (
    <section className={cx('note-view', note.meta.color && `note-view--${note.meta.color}`)} aria-label={note.meta.title}>
      <header className="note-view__head">
        {basic && (
          <Button icon={<ArrowLeft />} onClick={() => void closeNote()}>
            {t.nav.back}
          </Button>
        )}
        <TitleField key={note.path} note={note} focus={focusTitle} />
        <div className="note-view__actions">
          <IconButton
            icon={note.meta.pinned ? <PinOff /> : <Pin />}
            label={note.meta.pinned ? t.note.unpin : t.note.pin}
            showLabel={basic}
            active={note.meta.pinned}
            onClick={() => void setPinned(!note.meta.pinned)}
          />
          <ColorMenu color={note.meta.color} showLabel={basic} />
          {basic ? (
            <IconButton icon={<Trash2 />} label={t.note.trash} showLabel onClick={() => void trashCurrent()} />
          ) : (
            <DropdownMenu label={t.note.more} triggerClassName="dd-icon-button" trigger={<MoreHorizontal aria-hidden="true" />} items={moreItems} />
          )}
        </div>
      </header>
      <div className="note-view__meta">
        {!basic && note.path.includes('/') && <span className="chip chip--folder">{t.note.folderIn(note.path.slice(0, note.path.lastIndexOf('/')))}</span>}
        {can('tags', mode) && <TagEditor tags={note.meta.tags} />}
        <span className="toolbar__spacer" />
        <span className="note-view__date">{t.list.changed(shortDate(note.meta.modified))}</span>
        <SaveState />
      </div>
      <div className="note-view__scroll">
        <NoteEditor key={`${editorKey}-${mode}`} note={note} mode={mode} />
        {can('backlinks', mode) && (
          <aside className="backlinks" aria-label={t.note.backlinks}>
            <h2 className="backlinks__title">{t.note.backlinks}</h2>
            {backlinks.length === 0 ? (
              <p className="backlinks__empty">{t.note.noBacklinks}</p>
            ) : (
              <ul className="backlinks__list">
                {backlinks.map((item) => (
                  <li key={item.path}>
                    <button type="button" className="backlinks__item" onClick={() => void openNote(item.path)}>
                      <span className="backlinks__name">{item.title}</span>
                      <span className="backlinks__text">{item.excerpt}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
        {can('april', mode) && (
          <aside className="april-box" aria-label={t.april.title}>
            <div className="april-box__head">
              <Sparkles aria-hidden="true" />
              <strong>{t.april.title}</strong>
              <span className="april-box__badge">{t.april.comingSoon}</span>
            </div>
            <p>{t.april.text}</p>
            <div className="april-box__actions">
              <Button disabled>{t.april.summarize}</Button>
              <Button disabled>{t.april.findOld}</Button>
            </div>
          </aside>
        )}
      </div>
    </section>
  )
}

/** Only visible when printing: the note on white paper, for the PDF. */
export function PrintSheet({ title, html }: { title: string; html: string }): React.JSX.Element {
  return (
    <article className="print-sheet">
      <h1 className="print-sheet__title">{title}</h1>
      <div className="print-sheet__body" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  )
}
