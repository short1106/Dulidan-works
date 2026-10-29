import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { MenuBar, type MenuDefinition, type MenuEntry } from '@dulidan/design-system'
import { clampZoom } from '@dulidan/core'
import { ACTIONS, type ActionId } from '../actions'
import { shortcut, t } from '../i18n'
import { openRecent } from '../state/document'
import { updateSettings, useSettings } from '../state/settings'
import { setUi } from '../state/ui'
import { applyStyle, currentStyle, STYLE_IDS } from './ExpertToolbar'

const ZOOM_STEP = 10

export function changeZoom(current: number, delta: number | 'reset'): void {
  void updateSettings({ zoom: delta === 'reset' ? 100 : clampZoom(current + delta) })
}

/** File name without folder, for the recent list. */
function fileNameOf(filePath: string): string {
  return filePath.split(/[\\/]/).pop()?.replace(/\.glyph$/i, '') ?? filePath
}

/** The classic menu bar of expert and pro mode. */
export function AppMenuBar({ editor }: { editor: Editor }): React.JSX.Element {
  const settings = useSettings()
  // Re-render on every edit so checks and disabled states stay current.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      style: current ? currentStyle(current) : 'paragraph',
      inTable: current?.isActive('table') ?? false,
      marks: ['bold', 'italic', 'underline', 'alignLeft', 'alignCenter', 'alignRight', 'alignJustify', 'bulletList', 'orderedList'].map(
        (id) => (current ? (ACTIONS[id as ActionId].isActive?.(current) ?? false) : false)
      ),
      canUndo: current?.can().undo() ?? false,
      canRedo: current?.can().redo() ?? false
    })
  })

  const item = (id: ActionId, overrides: Partial<Extract<MenuEntry, { label: string }>> = {}): MenuEntry => {
    const action = ACTIONS[id]
    return { id, label: action.label, shortcut: action.shortcut, onSelect: () => action.run(editor), ...overrides }
  }
  const toggle = (id: ActionId, index: number): MenuEntry => item(id, { checked: state.marks[index] })
  const separator = (id: string): MenuEntry => ({ id, separator: true })
  const tableCommand = (id: string, label: string, run: () => void): MenuEntry => ({
    id,
    label,
    disabled: !state.inTable,
    onSelect: run
  })

  const recent: MenuEntry[] =
    settings.recentFiles.length > 0
      ? settings.recentFiles.map((filePath) => ({
          id: `recent-${filePath}`,
          label: fileNameOf(filePath),
          onSelect: () => void openRecent(filePath)
        }))
      : [{ id: 'recent-none', label: t.actions.noRecentFiles, disabled: true, onSelect: () => undefined }]

  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: t.menus.file,
      items: [
        item('new'),
        item('open', { label: `${t.actions.open} …` }),
        separator('sep-recent'),
        ...recent,
        separator('sep-save'),
        item('save'),
        item('saveAs'),
        { id: 'versions', label: t.actions.versions, onSelect: () => setUi({ versionsOpen: true }) },
        separator('sep-out'),
        item('pdf', { label: t.actions.exportPdf }),
        item('print')
      ]
    },
    {
      id: 'edit',
      label: t.menus.edit,
      items: [
        item('undo', { disabled: !state.canUndo }),
        item('redo', { disabled: !state.canRedo }),
        separator('sep-find'),
        item('find'),
        {
          id: 'replace',
          label: `${t.find.replace} …`,
          shortcut: shortcut('H'),
          onSelect: () => setUi({ findOpen: true, findWithReplace: true })
        }
      ]
    },
    {
      id: 'insert',
      label: t.menus.insert,
      items: [item('image', { label: t.actions.imageLong }), item('link'), item('table', { disabled: state.inTable })]
    },
    {
      id: 'format',
      label: t.menus.format,
      items: [
        toggle('bold', 0),
        toggle('italic', 1),
        toggle('underline', 2),
        separator('sep-styles'),
        ...STYLE_IDS.map((style) => ({
          id: `style-${style}`,
          label: t.styles[style],
          checked: state.style === style,
          onSelect: () => applyStyle(editor, style)
        })),
        separator('sep-align'),
        toggle('alignLeft', 3),
        toggle('alignCenter', 4),
        toggle('alignRight', 5),
        toggle('alignJustify', 6),
        separator('sep-lists'),
        toggle('bulletList', 7),
        toggle('orderedList', 8)
      ]
    },
    {
      id: 'table',
      label: t.menus.table,
      items: [
        item('table', { disabled: state.inTable }),
        separator('sep-table'),
        tableCommand('addRow', t.actions.addRowAfter, () => editor.chain().focus().addRowAfter().run()),
        tableCommand('addColumn', t.actions.addColumnAfter, () => editor.chain().focus().addColumnAfter().run()),
        tableCommand('deleteRow', t.actions.deleteRow, () => editor.chain().focus().deleteRow().run()),
        tableCommand('deleteColumn', t.actions.deleteColumn, () => editor.chain().focus().deleteColumn().run()),
        tableCommand('headerRow', t.actions.toggleHeaderRow, () => editor.chain().focus().toggleHeaderRow().run()),
        separator('sep-table-delete'),
        tableCommand('deleteTable', t.actions.deleteTable, () => editor.chain().focus().deleteTable().run())
      ]
    },
    {
      id: 'view',
      label: t.menus.view,
      items: [
        { id: 'zoomIn', label: t.actions.zoomIn, shortcut: shortcut('+'), onSelect: () => changeZoom(settings.zoom, ZOOM_STEP) },
        { id: 'zoomOut', label: t.actions.zoomOut, shortcut: shortcut('-'), onSelect: () => changeZoom(settings.zoom, -ZOOM_STEP) },
        { id: 'zoomReset', label: t.actions.zoomReset, shortcut: shortcut('0'), onSelect: () => changeZoom(settings.zoom, 'reset') },
        separator('sep-theme'),
        { id: 'dark', label: t.menus.themeDark, checked: settings.theme === 'dark', onSelect: () => void updateSettings({ theme: 'dark' }) },
        { id: 'light', label: t.menus.themeLight, checked: settings.theme === 'light', onSelect: () => void updateSettings({ theme: 'light' }) },
        separator('sep-settings'),
        item('settings', { label: `${t.actions.settings} …` })
      ]
    }
  ]

  return <MenuBar label={t.menus.label} menus={menus} className="app-menubar" />
}

export { ZOOM_STEP }
