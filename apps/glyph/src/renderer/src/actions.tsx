import type { Editor } from '@tiptap/core'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  FilePlus2,
  FileText,
  FolderOpen,
  Heading,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Printer,
  Redo2,
  Save,
  Search,
  Settings as SettingsIcon,
  Table,
  Underline,
  Undo2,
  type LucideIcon
} from 'lucide-react'
import { ADVANCED_MODES, ALL_MODES, type ModeScoped } from '@dulidan/core'
import { imageFileToDataUrl, pickImageFile } from './editor/images'
import { shortcut, t } from './i18n'
import { exportPdf, newDocument, openWithDialog, printDocument, save } from './state/document'
import { notify } from './state/notices'
import { setUi } from './state/ui'

/**
 * Every action of Glyph in one list. Each declares in which modes it is
 * visible. Toolbars and menus are built from this list, so a button and its
 * menu entry always do the same thing.
 */
export interface Action extends ModeScoped {
  id: string
  label: string
  icon: LucideIcon
  shortcut?: string
  run: (editor: Editor) => void
  isActive?: (editor: Editor) => boolean
  isEnabled?: (editor: Editor) => boolean
}

export async function insertImage(editor: Editor): Promise<void> {
  const file = await pickImageFile()
  if (!file) return
  try {
    const src = await imageFileToDataUrl(file)
    editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run()
  } catch {
    notify(t.errors.imageFailed, 'error')
  }
}

const actionList = [
  // File
  { id: 'new', label: t.actions.new, icon: FilePlus2, shortcut: shortcut('N'), modes: ALL_MODES, run: () => void newDocument() },
  { id: 'open', label: t.actions.open, icon: FolderOpen, shortcut: shortcut('O'), modes: ALL_MODES, run: () => void openWithDialog() },
  { id: 'save', label: t.actions.save, icon: Save, shortcut: shortcut('S'), modes: ALL_MODES, run: () => void save() },
  { id: 'saveAs', label: t.actions.saveAs, icon: Save, shortcut: shortcut('S', true), modes: ADVANCED_MODES, run: () => void save(true) },
  { id: 'pdf', label: t.actions.pdf, icon: FileText, shortcut: shortcut('P', true), modes: ALL_MODES, run: () => void exportPdf() },
  { id: 'print', label: t.actions.print, icon: Printer, shortcut: shortcut('P'), modes: ALL_MODES, run: () => void printDocument() },

  // Edit
  {
    id: 'undo',
    label: t.actions.undo,
    icon: Undo2,
    shortcut: shortcut('Z'),
    modes: ALL_MODES,
    run: (editor) => editor.chain().focus().undo().run(),
    isEnabled: (editor) => editor.can().undo()
  },
  {
    id: 'redo',
    label: t.actions.redo,
    icon: Redo2,
    shortcut: shortcut('Y'),
    modes: ADVANCED_MODES,
    run: (editor) => editor.chain().focus().redo().run(),
    isEnabled: (editor) => editor.can().redo()
  },
  {
    id: 'find',
    label: t.actions.findReplace,
    icon: Search,
    shortcut: shortcut('F'),
    modes: ADVANCED_MODES,
    run: () => setUi({ findOpen: true, findWithReplace: false })
  },

  // Text formatting
  {
    id: 'bold',
    label: t.actions.bold,
    icon: Bold,
    shortcut: shortcut('B'),
    modes: ALL_MODES,
    run: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold')
  },
  {
    id: 'italic',
    label: t.actions.italic,
    icon: Italic,
    shortcut: shortcut('I'),
    modes: ALL_MODES,
    run: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic')
  },
  {
    id: 'underline',
    label: t.actions.underline,
    icon: Underline,
    shortcut: shortcut('U'),
    modes: ADVANCED_MODES,
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor) => editor.isActive('underline')
  },
  {
    id: 'heading',
    label: t.actions.heading,
    icon: Heading,
    modes: ['basic'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 1 })
  },

  // Alignment
  ...(
    [
      ['alignLeft', 'left', AlignLeft, 'L'],
      ['alignCenter', 'center', AlignCenter, 'E'],
      ['alignRight', 'right', AlignRight, 'R'],
      ['alignJustify', 'justify', AlignJustify, 'J']
    ] as const
  ).map(([id, align, icon, key]) => ({
    id,
    label: t.actions[id],
    icon,
    shortcut: `${shortcut(key, true)}`,
    modes: ADVANCED_MODES,
    run: (editor: Editor) => editor.chain().focus().setTextAlign(align).run(),
    isActive: (editor: Editor) => editor.isActive({ textAlign: align })
  })),

  // Lists
  {
    id: 'bulletList',
    label: t.actions.bulletList,
    icon: List,
    shortcut: shortcut('8', true),
    modes: ALL_MODES,
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList')
  },
  {
    id: 'orderedList',
    label: t.actions.orderedList,
    icon: ListOrdered,
    shortcut: shortcut('7', true),
    modes: ADVANCED_MODES,
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList')
  },

  // Insert
  {
    id: 'link',
    label: t.actions.link,
    icon: Link2,
    shortcut: shortcut('K'),
    modes: ADVANCED_MODES,
    run: () => setUi({ linkOpen: true }),
    isActive: (editor) => editor.isActive('link')
  },
  { id: 'image', label: t.actions.image, icon: ImagePlus, modes: ALL_MODES, run: (editor) => void insertImage(editor) },
  {
    id: 'table',
    label: t.actions.insertTable,
    icon: Table,
    modes: ADVANCED_MODES,
    run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    isEnabled: (editor) => !editor.isActive('table')
  },

  { id: 'settings', label: t.actions.settings, icon: SettingsIcon, modes: ALL_MODES, run: () => setUi({ settingsOpen: true }) }
] satisfies Action[]

export type ActionId = (typeof actionList)[number]['id']

export const ACTIONS: Record<ActionId, Action> = Object.fromEntries(actionList.map((action) => [action.id, action])) as Record<
  ActionId,
  Action
>

/** The ten actions of basic mode, in toolbar order. */
export const BASIC_TOOLBAR: ActionId[] = ['new', 'open', 'save', 'pdf', 'bold', 'italic', 'heading', 'bulletList', 'image', 'undo']
