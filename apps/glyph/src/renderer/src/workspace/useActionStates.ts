import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { ACTIONS, type ActionId } from '../actions'

export interface ActionState {
  active: boolean
  enabled: boolean
}

/** Pressed and enabled state of the given actions, updated on every edit. */
export function useActionStates(editor: Editor, ids: readonly ActionId[]): Record<string, ActionState> {
  return useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const states: Record<string, ActionState> = {}
      for (const id of ids) {
        const action = ACTIONS[id]
        states[id] = {
          active: current ? (action.isActive?.(current) ?? false) : false,
          enabled: current ? (action.isEnabled?.(current) ?? true) : false
        }
      }
      return states
    }
  })
}
