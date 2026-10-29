import type { HTMLAttributes, KeyboardEvent } from 'react'
import { cx } from './cx'

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name, e.g. "Formatierung". */
  label: string
}

/**
 * Row of controls. Arrow keys move between them, so keyboard users can
 * reach every button without tabbing through all of them.
 */
export function Toolbar({ label, className, children, onKeyDown, ...rest }: ToolbarProps): React.JSX.Element {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    onKeyDown?.(event)
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const target = event.target as HTMLElement
    // Do not steal arrow keys from inputs and selects inside the toolbar.
    if (target.matches('input, select, textarea')) return
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select, input')
    )
    const index = items.indexOf(target)
    if (index === -1) return
    event.preventDefault()
    const next = event.key === 'ArrowRight' ? index + 1 : index - 1
    items[(next + items.length) % items.length]?.focus()
  }

  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cx('dd-toolbar', className)}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        // A mouse click on a button must not take the focus away from the
        // document, otherwise the first typed letters after it get lost.
        // Keyboard users still reach every button with Tab and arrow keys.
        if ((event.target as HTMLElement).closest('button')) event.preventDefault()
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

/** Thin vertical line between groups of toolbar buttons. */
export function ToolbarSeparator(): React.JSX.Element {
  return <span className="dd-toolbar__separator" role="separator" aria-orientation="vertical" />
}
