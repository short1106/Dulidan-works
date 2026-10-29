import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import {
  Bold,
  Code,
  FilePlus2,
  Heading,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Paperclip,
  Quote,
  Table2
} from 'lucide-react'
import { ask, Button, DropdownMenu, IconButton, notify, Toolbar, ToolbarSeparator } from '@dulidan/design-system'
import { pickFiles, ACCEPTED_IMAGE_TYPES } from '@dulidan/editor'
import type { Mode } from '@dulidan/core'
import { ATTACHMENT_URL, type JsonNode } from '@dulidan/notes-core'
import type { OpenedNote } from '../../../shared/ipc'
import { can } from '../features'
import { shortcut, t } from '../i18n'
import { createNote, markChanged, openNote, registerEditor } from '../state/note'
import { errorText } from '../state/notes'
import { createExtensions } from './extensions'
import { editorToMarkdown, noteToEditorHtml } from './markdown'
import type { LinkSuggestion } from './wikiLinks'

interface SuggestionView {
  items: LinkSuggestion[]
  index: number
  rect: DOMRect | null
  select: (item: LinkSuggestion) => void
}

const ALLOWED_LINK = /^(https?:\/\/|mailto:)/i

function normalizeUrl(value: string): string | null {
  const url = value.trim()
  if (!url) return null
  if (ALLOWED_LINK.test(url)) return url
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(url)) return `mailto:${url}`
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(url)) return `https://${url}`
  return null
}

/** Stores a file in the attachments folder; returns its address in the window. */
async function storeFile(file: File): Promise<string | null> {
  const result = await window.cortex.attachments.save(new Uint8Array(await file.arrayBuffer()), file.name)
  if (!result.ok) {
    notify(result.error === 'too-big' ? t.editor.tooBig : errorText(result.error), 'error')
    return null
  }
  return ATTACHMENT_URL + encodeURIComponent(result.value)
}

async function insertImages(editor: Editor, files: File[]): Promise<void> {
  for (const file of files.filter((item) => ACCEPTED_IMAGE_TYPES.includes(item.type))) {
    const src = await storeFile(file)
    if (src) editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run()
  }
}

async function insertAttachments(editor: Editor, files: File[]): Promise<void> {
  for (const file of files) {
    const href = await storeFile(file)
    if (!href) continue
    editor
      .chain()
      .focus()
      .insertContent([
        { type: 'text', text: file.name, marks: [{ type: 'link', attrs: { href } }] },
        { type: 'text', text: ' ' }
      ])
      .run()
  }
}

/** Strg + Klick on a link: web address, attached file or another note. */
async function openTarget(href: string | null, wikiTarget: string | null): Promise<void> {
  if (wikiTarget) {
    const path = await window.cortex.notes.resolveLink(wikiTarget)
    if (path) return openNote(path)
    const answer = await ask({
      title: t.editor.missingNoteTitle,
      text: t.editor.missingNoteText(wikiTarget),
      cancelValue: 'no',
      choices: [
        { value: 'no', label: t.dialogs.cancel, variant: 'ghost' },
        { value: 'yes', label: t.editor.create, variant: 'primary' }
      ]
    })
    if (answer === 'yes') await createNote(wikiTarget)
    return
  }
  if (!href) return
  if (href.startsWith(ATTACHMENT_URL)) {
    const name = decodeURIComponent(href.slice(ATTACHMENT_URL.length))
    const answer = await ask({
      title: t.editor.openAttachmentTitle,
      text: t.editor.openAttachmentText(name),
      cancelValue: 'no',
      choices: [
        { value: 'no', label: t.dialogs.cancel, variant: 'ghost' },
        { value: 'yes', label: t.editor.openLink, variant: 'primary' }
      ]
    })
    if (answer !== 'yes') return
    const result = await window.cortex.attachments.open(name)
    if (!result.ok) notify(result.error === 'invalid-path' ? t.editor.attachmentBlocked : t.editor.attachmentMissing, 'error')
    return
  }
  if (!ALLOWED_LINK.test(href)) return
  const answer = await ask({
    title: t.editor.openLinkTitle,
    text: t.editor.openLinkText(href),
    cancelValue: 'no',
    choices: [
      { value: 'no', label: t.dialogs.cancel, variant: 'ghost' },
      { value: 'yes', label: t.editor.openLink, variant: 'primary' }
    ]
  })
  if (answer === 'yes') await window.cortex.openLink(href)
}

export interface NoteEditorProps {
  note: OpenedNote
  mode: Mode
}

/** The text of one note with its toolbar. */
export function NoteEditor({ note, mode }: NoteEditorProps): React.JSX.Element | null {
  const basic = mode === 'basic'
  const linksOn = can('links', mode)
  const [suggestion, setSuggestion] = useState<SuggestionView | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const editorRef = useRef<Editor | null>(null)

  const extensions = useMemo(
    () =>
      createExtensions(
        linksOn
          ? {
              suggest: async (text) => (await window.cortex.notes.suggest(text)).filter((item) => item.path !== note.path),
              ui: { show: setSuggestion }
            }
          : null
      ),
    // The editor is created again for every note (key), so this list stays fixed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const editor = useEditor({
    extensions,
    content: noteToEditorHtml(note.body, note.path),
    editorProps: {
      attributes: { class: 'note-editor__content', 'aria-label': t.note.textLabel, role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true', lang: 'de' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? [])
        if (!editorRef.current || !files.some((file) => ACCEPTED_IMAGE_TYPES.includes(file.type))) return false
        void insertImages(editorRef.current, files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (!editorRef.current || files.length === 0) return false
        event.preventDefault()
        const images = files.filter((file) => ACCEPTED_IMAGE_TYPES.includes(file.type))
        void insertImages(editorRef.current, images)
        if (can('attachments', mode)) void insertAttachments(editorRef.current, files.filter((file) => !images.includes(file)))
        return true
      },
      handleClick: (_view, _pos, event) => {
        if (!(event.ctrlKey || event.metaKey)) return false
        const target = event.target as HTMLElement
        const wiki = target.closest<HTMLElement>('.wiki-link')?.dataset['target'] ?? null
        const href = target.closest('a')?.getAttribute('href') ?? null
        if (!wiki && !href) return false
        event.preventDefault()
        void openTarget(href, wiki)
        return true
      }
    },
    onUpdate: () => markChanged()
  })

  useEffect(() => {
    editorRef.current = editor
    if (!editor) return
    registerEditor({ markdown: () => editorToMarkdown(editor.getJSON() as JsonNode, note.path), html: () => editor.getHTML() })
    return () => registerEditor(null)
  }, [editor, note.path])

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      heading: ([1, 2, 3] as const).find((level) => current?.isActive('heading', { level })) ?? 0,
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      bulletList: current?.isActive('bulletList') ?? false,
      orderedList: current?.isActive('orderedList') ?? false,
      taskList: current?.isActive('taskList') ?? false,
      blockquote: current?.isActive('blockquote') ?? false,
      codeBlock: current?.isActive('codeBlock') ?? false,
      link: current?.isActive('link') ?? false,
      table: current?.isActive('table') ?? false
    })
  })

  if (!editor || !state) return null
  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus()

  const applyLink = (): void => {
    const href = normalizeUrl(linkValue)
    if (href) chain().extendMarkRange('link').setLink({ href }).run()
    setLinkOpen(false)
  }

  return (
    <div
      className="note-editor"
      onKeyDown={(event) => {
        // Strg+K: add or change a link (expert mode).
        if (!basic && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault()
          setLinkValue((editor.getAttributes('link')['href'] as string | undefined) ?? '')
          setLinkOpen(true)
        }
      }}
    >
      <Toolbar label={t.editor.toolbar} className="note-editor__toolbar">
        {can('headings', mode) && (
          <DropdownMenu
            label={t.editor.headingMenu}
            triggerClassName="dd-icon-button heading-trigger"
            trigger={
              <>
                <Heading aria-hidden="true" />
                <span>{state.heading ? t.editor.heading(state.heading) : t.editor.paragraph}</span>
              </>
            }
            items={[
              { id: 'p', label: t.editor.paragraph, checked: state.heading === 0, onSelect: () => chain().setParagraph().run() },
              ...([1, 2, 3] as const).map((level) => ({
                id: `h${level}`,
                label: t.editor.heading(level),
                checked: state.heading === level,
                onSelect: () => chain().toggleHeading({ level }).run()
              }))
            ]}
          />
        )}
        <IconButton icon={<Bold />} label={t.editor.bold} shortcut={shortcut('B')} showLabel={basic} active={state.bold} onClick={() => chain().toggleBold().run()} />
        <IconButton icon={<Italic />} label={t.editor.italic} shortcut={shortcut('I')} showLabel={basic} active={state.italic} onClick={() => chain().toggleItalic().run()} />
        {!basic && <ToolbarSeparator />}
        <IconButton icon={<List />} label={t.editor.bulletList} showLabel={basic} active={state.bulletList} onClick={() => chain().toggleBulletList().run()} />
        {!basic && <IconButton icon={<ListOrdered />} label={t.editor.orderedList} active={state.orderedList} onClick={() => chain().toggleOrderedList().run()} />}
        <IconButton icon={<ListChecks />} label={t.editor.taskList} showLabel={basic} active={state.taskList} onClick={() => chain().toggleTaskList().run()} />
        {can('quoteAndCode', mode) && (
          <>
            <ToolbarSeparator />
            <IconButton icon={<Quote />} label={t.editor.quote} active={state.blockquote} onClick={() => chain().toggleBlockquote().run()} />
            <IconButton icon={<Code />} label={t.editor.codeBlock} active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()} />
          </>
        )}
        {!basic && <ToolbarSeparator />}
        {!basic && (
          <IconButton
            icon={<Link2 />}
            label={t.editor.link}
            shortcut={shortcut('K')}
            active={state.link}
            onClick={() => {
              setLinkValue((editor.getAttributes('link')['href'] as string | undefined) ?? '')
              setLinkOpen(!linkOpen)
            }}
          />
        )}
        {linksOn && <IconButton icon={<FilePlus2 />} label={t.editor.wikiLink} onClick={() => chain().insertContent('[[').run()} />}
        <IconButton
          icon={<ImagePlus />}
          label={t.editor.image}
          showLabel={basic}
          onClick={() => void pickFiles(ACCEPTED_IMAGE_TYPES.join(','), true).then((files) => insertImages(editor, files))}
        />
        {can('attachments', mode) && (
          <IconButton icon={<Paperclip />} label={t.editor.attachment} onClick={() => void pickFiles('', true).then((files) => insertAttachments(editor, files))} />
        )}
        {can('tables', mode) && (
          <DropdownMenu
            label={t.editor.table}
            triggerClassName="dd-icon-button"
            trigger={<Table2 aria-hidden="true" />}
            items={[
              { id: 'insert', label: t.editor.tableInsert, onSelect: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
              { id: 'sep', separator: true },
              { id: 'row', label: t.editor.tableRowAfter, disabled: !state.table, onSelect: () => chain().addRowAfter().run() },
              { id: 'col', label: t.editor.tableColumnAfter, disabled: !state.table, onSelect: () => chain().addColumnAfter().run() },
              { id: 'delRow', label: t.editor.tableRowDelete, disabled: !state.table, onSelect: () => chain().deleteRow().run() },
              { id: 'delCol', label: t.editor.tableColumnDelete, disabled: !state.table, onSelect: () => chain().deleteColumn().run() },
              { id: 'delTable', label: t.editor.tableDelete, disabled: !state.table, onSelect: () => chain().deleteTable().run() }
            ]}
          />
        )}
      </Toolbar>
      {linkOpen && (
        <form
          className="note-editor__link"
          onSubmit={(event) => {
            event.preventDefault()
            applyLink()
          }}
        >
          <input
            className="note-editor__link-input"
            aria-label={t.editor.linkAddress}
            placeholder="https://"
            value={linkValue}
            autoFocus
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setLinkOpen(false)
            }}
          />
          <Button type="submit" variant="primary">
            {t.editor.linkApply}
          </Button>
          {state.link && (
            <Button
              onClick={() => {
                chain().extendMarkRange('link').unsetLink().run()
                setLinkOpen(false)
              }}
            >
              {t.editor.linkRemove}
            </Button>
          )}
        </form>
      )}
      <EditorContent editor={editor} className="note-editor__body" />
      {suggestion && suggestion.items.length > 0 && suggestion.rect && (
        <ul
          className="link-suggestions"
          role="listbox"
          aria-label={t.editor.suggestions}
          style={{ left: suggestion.rect.left, top: suggestion.rect.bottom + 6 }}
        >
          {suggestion.items.map((item, index) => (
            <li
              key={`${item.path ?? 'new'}-${item.title}`}
              role="option"
              aria-selected={index === suggestion.index}
              className={index === suggestion.index ? 'is-active' : undefined}
              onMouseDown={(event) => {
                event.preventDefault()
                suggestion.select(item)
              }}
            >
              {item.path ? item.title : t.editor.noSuggestion(item.title)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
