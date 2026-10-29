import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cx } from './cx'
import { CornerBrackets } from './Card'

export interface DialogProps {
  open: boolean
  title: string
  /** Called on Escape, on the backdrop and by the close actions. */
  onClose: () => void
  children: ReactNode
  /** Buttons at the bottom, right aligned. */
  actions?: ReactNode
  className?: string
  /** Prevents closing with Escape, e.g. for a required choice. */
  dismissible?: boolean
}

/**
 * Modal dialog based on the native <dialog> element, which keeps keyboard
 * focus inside the dialog while it is open.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
  className,
  dismissible = true
}: DialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={cx('dd-dialog', className)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape key: we decide ourselves whether the dialog closes.
        event.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(event) => {
        // A click on the dark backdrop lands on the <dialog> itself.
        if (dismissible && event.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="dd-dialog__panel">
          <CornerBrackets />
          <h2 id={titleId} className="dd-dialog__title">
            {title}
          </h2>
          <div className="dd-dialog__body">{children}</div>
          {actions && <div className="dd-dialog__actions">{actions}</div>}
        </div>
      )}
    </dialog>
  )
}
