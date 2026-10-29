import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { Baseline, Columns3, Rows3, Trash2 } from 'lucide-react'
import { DropdownMenu, IconButton, Toolbar, ToolbarSeparator } from '@dulidan/design-system'
import { ACTIONS, type ActionId } from '../actions'
import { DEFAULT_FONT_SIZE, FONT_FAMILIES, FONT_SIZES, TEXT_COLORS } from '../editor/extensions'
import { t } from '../i18n'
import { useActionStates } from './useActionStates'

const GROUPS: ActionId[][] = [
  ['undo', 'redo'],
  ['bold', 'italic', 'underline'],
  ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'],
  ['bulletList', 'orderedList'],
  ['link', 'image', 'table'],
  ['find']
]

export type StyleId = 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'quote'

export const STYLE_IDS: StyleId[] = ['paragraph', 'heading1', 'heading2', 'heading3', 'quote']

/** Applies a paragraph style (Formatvorlage). */
export function applyStyle(editor: Editor, style: StyleId): void {
  const chain = editor.chain().focus()
  if (style === 'quote') {
    if (!editor.isActive('blockquote')) chain.setParagraph().setBlockquote().run()
    return
  }
  if (editor.isActive('blockquote')) chain.unsetBlockquote()
  if (style === 'paragraph') chain.setParagraph().run()
  else chain.setHeading({ level: Number(style.slice(-1)) as 1 | 2 | 3 }).run()
}

export function currentStyle(editor: Editor): StyleId {
  for (const level of [1, 2, 3] as const) if (editor.isActive('heading', { level })) return `heading${level}`
  if (editor.isActive('blockquote')) return 'quote'
  return 'paragraph'
}

/** Expert and pro mode: the full toolbar with styles, fonts and colors. */
export function ExpertToolbar({ editor }: { editor: Editor }): React.JSX.Element {
  const states = useActionStates(editor, GROUPS.flat())
  const format = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const textStyle = current?.getAttributes('textStyle') ?? {}
      return {
        style: current ? currentStyle(current) : 'paragraph',
        fontFamily: (textStyle['fontFamily'] as string | undefined) ?? '',
        fontSize: (textStyle['fontSize'] as string | undefined) ?? '',
        color: (textStyle['color'] as string | undefined) ?? '',
        inTable: current?.isActive('table') ?? false
      }
    }
  })

  const fontSizeValue = format.fontSize ? parseFloat(format.fontSize) : DEFAULT_FONT_SIZE

  return (
    <Toolbar label={t.toolbar.label} className="toolbar toolbar--expert">
      {GROUPS.map((group, groupIndex) => (
        <span key={group.join()} className="toolbar__group">
          {groupIndex > 0 && <ToolbarSeparator />}
          {group.map((id) => {
            const action = ACTIONS[id]
            const Icon = action.icon
            return (
              <IconButton
                key={id}
                icon={<Icon />}
                label={action.label.replace(' …', '')}
                shortcut={action.shortcut}
                active={action.isActive ? states[id]?.active : undefined}
                disabled={!states[id]?.enabled}
                onClick={() => action.run(editor)}
              />
            )
          })}
          {/* Styles and fonts sit after undo/redo */}
          {groupIndex === 0 && (
            <>
              <ToolbarSeparator />
              <select
                className="toolbar__select toolbar__select--style"
                aria-label={t.actions.styles}
                title={t.actions.styles}
                value={format.style}
                onChange={(event) => applyStyle(editor, event.target.value as StyleId)}
              >
                {STYLE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t.styles[id]}
                  </option>
                ))}
              </select>
              <select
                className="toolbar__select toolbar__select--font"
                aria-label={t.actions.fontFamily}
                title={t.actions.fontFamily}
                value={format.fontFamily}
                onChange={(event) => {
                  const value = event.target.value
                  if (value) editor.chain().focus().setFontFamily(value).run()
                  else editor.chain().focus().unsetFontFamily().run()
                }}
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font.label} value={font.value ?? ''}>
                    {font.label}
                  </option>
                ))}
              </select>
              <select
                className="toolbar__select toolbar__select--size"
                aria-label={t.actions.fontSize}
                title={t.actions.fontSize}
                value={fontSizeValue}
                onChange={(event) => {
                  const size = Number(event.target.value)
                  if (size === DEFAULT_FONT_SIZE) editor.chain().focus().unsetFontSize().run()
                  else editor.chain().focus().setFontSize(`${size}pt`).run()
                }}
              >
                {[...new Set([...FONT_SIZES, fontSizeValue])]
                  .sort((a, b) => a - b)
                  .map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
              </select>
            </>
          )}
          {/* Text color after bold/italic/underline */}
          {groupIndex === 1 && (
            <DropdownMenu
              label={t.actions.textColor}
              triggerClassName="toolbar__color"
              trigger={
                <>
                  <Baseline aria-hidden="true" />
                  <span className="toolbar__color-bar" style={{ background: format.color || 'currentColor' }} />
                </>
              }
              items={[
                {
                  id: 'default',
                  label: t.colors.default,
                  checked: !format.color,
                  onSelect: () => editor.chain().focus().unsetColor().run()
                },
                ...TEXT_COLORS.map((color, index) => ({
                  id: color,
                  label: t.colors.names[index] ?? color,
                  icon: <span className="color-swatch" style={{ background: color }} />,
                  onSelect: () => editor.chain().focus().setColor(color).run()
                }))
              ]}
            />
          )}
        </span>
      ))}

      {/* Extra buttons while the cursor is inside a table */}
      {format.inTable && (
        <span className="toolbar__group toolbar__group--table">
          <ToolbarSeparator />
          <IconButton icon={<Rows3 />} label={t.actions.addRowAfter} onClick={() => editor.chain().focus().addRowAfter().run()} />
          <IconButton icon={<Columns3 />} label={t.actions.addColumnAfter} onClick={() => editor.chain().focus().addColumnAfter().run()} />
          <IconButton icon={<Trash2 />} label={t.actions.deleteTable} onClick={() => editor.chain().focus().deleteTable().run()} />
        </span>
      )}

      <span className="toolbar__spacer" />
    </Toolbar>
  )
}
