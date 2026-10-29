import { MenuBar, type MenuDefinition, type MenuEntry } from '@dulidan/design-system'
import { getDoc, history, redo, undo, useDoc } from '../engine/document'
import { addLayer, moveActiveLayer, removeActiveLayer, toggleLayerVisibility } from '../engine/layers'
import { shortcut, t } from '../i18n'
import { exportImage, openRecent, openWithDialog, saveProject } from '../state/session'
import { updateSettings, useSettings } from '../state/settings'
import { setTool } from '../state/tools'
import { setUi } from '../state/ui'
import { actualSize, fitToView, zoomStep } from '../state/viewport'

function fileNameOf(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

/** The menu bar of expert and pro mode. */
export function AppMenuBar(): React.JSX.Element {
  const { doc } = useDoc()
  const settings = useSettings()
  const separator = (id: string): MenuEntry => ({ id, separator: true })
  const index = doc.layers.findIndex((layer) => layer.id === doc.activeLayerId)

  const recent: MenuEntry[] =
    settings.recentFiles.length > 0
      ? settings.recentFiles.map((filePath) => ({ id: `recent-${filePath}`, label: fileNameOf(filePath), onSelect: () => void openRecent(filePath) }))
      : [{ id: 'recent-none', label: t.actions.noRecentFiles, disabled: true, onSelect: () => undefined }]

  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: t.menus.file,
      items: [
        { id: 'new', label: t.actions.new, shortcut: shortcut('N'), onSelect: () => setUi({ newOpen: true }) },
        { id: 'open', label: t.actions.open, shortcut: shortcut('O'), onSelect: () => void openWithDialog() },
        separator('sep-recent'),
        ...recent,
        separator('sep-save'),
        { id: 'save', label: t.actions.save, shortcut: shortcut('S'), onSelect: () => void saveProject() },
        { id: 'saveAs', label: t.actions.saveAs, shortcut: shortcut('S', true), onSelect: () => void saveProject(true) },
        separator('sep-export'),
        { id: 'png', label: t.actions.exportPng, shortcut: shortcut('E', true), onSelect: () => void exportImage('png') },
        { id: 'jpg', label: t.actions.exportJpg, onSelect: () => void exportImage('jpg') }
      ]
    },
    {
      id: 'edit',
      label: t.menus.edit,
      items: [
        { id: 'undo', label: t.actions.undo, shortcut: shortcut('Z'), disabled: !history.canUndo(), onSelect: undo },
        { id: 'redo', label: t.actions.redo, shortcut: shortcut('Y'), disabled: !history.canRedo(), onSelect: redo }
      ]
    },
    {
      id: 'image',
      label: t.menus.image,
      items: [
        { id: 'crop', label: t.actions.crop, shortcut: 'C', onSelect: () => setTool('crop') },
        { id: 'resize', label: t.actions.resize, onSelect: () => setUi({ resizeOpen: true }) }
      ]
    },
    {
      id: 'layer',
      label: t.menus.layer,
      items: [
        { id: 'add', label: t.layers.add, shortcut: shortcut('N', true), onSelect: addLayer },
        { id: 'remove', label: t.layers.remove, disabled: doc.layers.length <= 1, onSelect: removeActiveLayer },
        separator('sep-order'),
        { id: 'up', label: t.layers.up, disabled: index >= doc.layers.length - 1, onSelect: () => moveActiveLayer(1) },
        { id: 'down', label: t.layers.down, disabled: index <= 0, onSelect: () => moveActiveLayer(-1) },
        separator('sep-visible'),
        {
          id: 'visible',
          label: `${t.layers.show} / ${t.layers.hide}`,
          onSelect: () => toggleLayerVisibility(getDoc().activeLayerId)
        }
      ]
    },
    {
      id: 'view',
      label: t.menus.view,
      items: [
        { id: 'zoomIn', label: t.actions.zoomIn, shortcut: shortcut('+'), onSelect: () => zoomStep(1) },
        { id: 'zoomOut', label: t.actions.zoomOut, shortcut: shortcut('-'), onSelect: () => zoomStep(-1) },
        { id: 'fit', label: t.actions.zoomFit, shortcut: shortcut('0'), onSelect: () => fitToView(doc.width, doc.height) },
        { id: 'actual', label: t.actions.zoom100, shortcut: shortcut('1'), onSelect: () => actualSize(doc.width, doc.height) },
        separator('sep-theme'),
        { id: 'dark', label: t.menus.themeDark, checked: settings.theme === 'dark', onSelect: () => void updateSettings({ theme: 'dark' }) },
        { id: 'light', label: t.menus.themeLight, checked: settings.theme === 'light', onSelect: () => void updateSettings({ theme: 'light' }) },
        separator('sep-settings'),
        { id: 'settings', label: `${t.actions.settings} …`, onSelect: () => setUi({ settingsOpen: true }) }
      ]
    }
  ]
  return <MenuBar label={t.menus.label} menus={menus} className="app-menubar" />
}
