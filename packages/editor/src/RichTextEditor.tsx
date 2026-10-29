import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extensions'
import { Bold, ImagePlus, Italic, Link2, List, ListOrdered } from 'lucide-react'
import { Button, IconButton, Toolbar } from '@dulidan/design-system'
import { ACCEPTED_IMAGE_TYPES, imageFileToDataUrl, pickFiles } from './images'

/** German labels by default; apps can pass their own. */
export const DEFAULT_LABELS = {
  toolbar: 'Formatierung',
  bold: 'Fett',
  italic: 'Kursiv',
  bulletList: 'Liste',
  orderedList: 'Nummerierte Liste',
  link: 'Link',
  linkAddress: 'Adresse des Links',
  linkApply: 'Übernehmen',
  linkRemove: 'Link entfernen',
  image: 'Bild einfügen',
  placeholder: 'Hier schreiben …',
  editor: 'Text'
}

export type EditorLabels = typeof DEFAULT_LABELS

export interface RichTextEditorProps {
  /** HTML at the start; later changes of this prop are ignored. */
  initialHtml: string
  onChange: (html: string, text: string) => void
  labels?: Partial<EditorLabels>
  /** Show toolbar labels as words (basic mode). */
  showLabels?: boolean
  className?: string
  autofocus?: boolean
  /** Called when an image could not be read. */
  onImageError?: () => void
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

async function insertImages(editor: Editor, files: File[], onError?: () => void): Promise<void> {
  for (const file of files.filter((item) => ACCEPTED_IMAGE_TYPES.includes(item.type))) {
    try {
      editor.chain().focus().setImage({ src: await imageFileToDataUrl(file), alt: file.name }).run()
    } catch {
      onError?.()
    }
  }
}

/**
 * A lean rich text editor: bold, italic, lists, links and images.
 * The same TipTap core as in Glyph, reduced to what a mail needs.
 */
export function RichTextEditor({ initialHtml, onChange, labels: custom, showLabels = false, className, autofocus, onImageError }: RichTextEditorProps): React.JSX.Element | null {
  const labels = { ...DEFAULT_LABELS, ...custom }
  const changeRef = useRef(onChange)
  changeRef.current = onChange
  const editorRef = useRef<Editor | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', protocols: ['http', 'https', 'mailto'] }
      }),
      Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: labels.placeholder })
    ],
    content: initialHtml,
    autofocus: autofocus ? 'start' : false,
    editorProps: {
      attributes: { class: 'dd-rte__content', 'aria-label': labels.editor, role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true', lang: 'de' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? [])
        if (!editorRef.current || !files.some((file) => ACCEPTED_IMAGE_TYPES.includes(file.type))) return false
        void insertImages(editorRef.current, files, onImageError)
        return true
      }
    },
    onUpdate: ({ editor: current }) => changeRef.current(current.getHTML(), current.getText())
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      bulletList: current?.isActive('bulletList') ?? false,
      orderedList: current?.isActive('orderedList') ?? false,
      link: current?.isActive('link') ?? false
    })
  })

  if (!editor || !state) return null

  const applyLink = (): void => {
    const href = normalizeUrl(linkValue)
    if (href) editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setLinkOpen(false)
  }

  return (
    <div className={`dd-rte ${className ?? ''}`}>
      <Toolbar label={labels.toolbar} className="dd-rte__toolbar">
        <IconButton icon={<Bold />} label={labels.bold} shortcut="Strg+B" showLabel={showLabels} active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
        <IconButton icon={<Italic />} label={labels.italic} shortcut="Strg+I" showLabel={showLabels} active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <IconButton icon={<List />} label={labels.bulletList} showLabel={showLabels} active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <IconButton icon={<ListOrdered />} label={labels.orderedList} showLabel={showLabels} active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <IconButton
          icon={<Link2 />}
          label={labels.link}
          showLabel={showLabels}
          active={state.link}
          onClick={() => {
            setLinkValue((editor.getAttributes('link')['href'] as string | undefined) ?? '')
            setLinkOpen(!linkOpen)
          }}
        />
        <IconButton
          icon={<ImagePlus />}
          label={labels.image}
          showLabel={showLabels}
          onClick={() => void pickFiles(ACCEPTED_IMAGE_TYPES.join(','), true).then((files) => insertImages(editor, files, onImageError))}
        />
      </Toolbar>
      {linkOpen && (
        <form
          className="dd-rte__link"
          onSubmit={(event) => {
            event.preventDefault()
            applyLink()
          }}
        >
          <input
            className="dd-rte__link-input"
            aria-label={labels.linkAddress}
            placeholder="https://"
            value={linkValue}
            autoFocus
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setLinkOpen(false)
            }}
          />
          <Button type="submit" variant="primary">
            {labels.linkApply}
          </Button>
          {state.link && (
            <Button
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run()
                setLinkOpen(false)
              }}
            >
              {labels.linkRemove}
            </Button>
          )}
        </form>
      )}
      <EditorContent editor={editor} className="dd-rte__body" />
    </div>
  )
}
