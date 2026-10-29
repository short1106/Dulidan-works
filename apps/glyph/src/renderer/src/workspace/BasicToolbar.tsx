import type { Editor } from '@tiptap/core'
import { IconButton, Toolbar, ToolbarSeparator } from '@dulidan/design-system'
import { ACTIONS, BASIC_TOOLBAR } from '../actions'
import { t } from '../i18n'
import { useActionStates } from './useActionStates'

/** Basic mode: ten big buttons with words, plus settings at the end. */
export function BasicToolbar({ editor }: { editor: Editor }): React.JSX.Element {
  const states = useActionStates(editor, BASIC_TOOLBAR)
  const settings = ACTIONS.settings
  return (
    <Toolbar label={t.toolbar.label} className="toolbar toolbar--basic">
      {BASIC_TOOLBAR.map((id, index) => {
        const action = ACTIONS[id]
        const Icon = action.icon
        return (
          <span key={id} className="toolbar__item">
            {index === 4 && <ToolbarSeparator />}
            <IconButton
              icon={<Icon />}
              label={action.label}
              shortcut={action.shortcut}
              showLabel
              active={action.isActive ? states[id]?.active : undefined}
              disabled={!states[id]?.enabled}
              onClick={() => action.run(editor)}
            />
          </span>
        )
      })}
      <span className="toolbar__spacer" />
      <IconButton icon={<settings.icon />} label={settings.label} showLabel onClick={() => settings.run(editor)} />
    </Toolbar>
  )
}
