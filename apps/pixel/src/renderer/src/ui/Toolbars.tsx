import { ImageDown, Redo2, Save, Settings as SettingsIcon, Undo2 } from 'lucide-react'
import { IconButton, Toolbar, ToolbarSeparator } from '@dulidan/design-system'
import { filterByMode } from '@dulidan/core'
import { history, redo, undo, useDoc } from '../engine/document'
import { shortcut, t } from '../i18n'
import { saveAsImage, saveProject } from '../state/session'
import { useMode } from '../state/settings'
import { setTool, useTools } from '../state/tools'
import { setUi } from '../state/ui'
import { toolLabel, TOOLS } from '../tools'
import { PALETTE, Swatches } from './ColorPicker'

/** Tool buttons for the current mode. */
function ToolButtons({ showLabels }: { showLabels: boolean }): React.JSX.Element {
  const mode = useMode()
  const { tool } = useTools()
  return (
    <>
      {filterByMode(TOOLS, mode).map((definition) => {
        const Icon = definition.icon
        return (
          <IconButton
            key={definition.id}
            icon={<Icon />}
            label={toolLabel(definition, mode)}
            shortcut={definition.key}
            showLabel={showLabels}
            active={tool === definition.id}
            onClick={() => setTool(definition.id)}
          />
        )
      })}
    </>
  )
}

/** Basic mode: one row of big labeled buttons, then colors. */
export function BasicToolbar(): React.JSX.Element {
  useDoc() // re-render when undo becomes possible
  const { color } = useTools()
  return (
    <div className="basic-bar">
      <Toolbar label={t.tools.label} className="toolbar toolbar--basic">
        <ToolButtons showLabels />
        <ToolbarSeparator />
        <IconButton icon={<Undo2 />} label={t.actions.undo} shortcut={shortcut('Z')} showLabel disabled={!history.canUndo()} onClick={undo} />
        <IconButton icon={<Save />} label={t.actions.save} shortcut={shortcut('S')} showLabel onClick={() => void saveProject()} />
        <IconButton icon={<ImageDown />} label={t.actions.saveImage} showLabel onClick={() => void saveAsImage()} />
        <span className="toolbar__spacer" />
        <IconButton icon={<SettingsIcon />} label={t.actions.settings} showLabel onClick={() => setUi({ settingsOpen: true })} />
      </Toolbar>
      <div className="basic-bar__colors">
        <Swatches colors={PALETTE} current={color} label={t.color.label} names={t.color.names} large />
      </div>
    </div>
  )
}

/** Expert mode: vertical tool column on the left. */
export function ToolColumn(): React.JSX.Element {
  useDoc()
  return (
    <Toolbar label={t.tools.label} className="tool-column" aria-orientation="vertical">
      <ToolButtons showLabels={false} />
      <ToolbarSeparator />
      <IconButton icon={<Undo2 />} label={t.actions.undo} shortcut={shortcut('Z')} disabled={!history.canUndo()} onClick={undo} />
      <IconButton icon={<Redo2 />} label={t.actions.redo} shortcut={shortcut('Y')} disabled={!history.canRedo()} onClick={redo} />
    </Toolbar>
  )
}
