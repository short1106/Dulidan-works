import type { ReactNode } from 'react'
import { cx } from './cx'

export interface NoticeProps {
  tone?: 'info' | 'success' | 'error'
  icon?: ReactNode
  children: ReactNode
  className?: string
  /** Shows a close button when given. */
  onClose?: () => void
  closeLabel?: string
}

/** Short message to the user. Screen readers announce it automatically. */
export function Notice({
  tone = 'info',
  icon,
  children,
  className,
  onClose,
  closeLabel = 'Schließen'
}: NoticeProps): React.JSX.Element {
  return (
    <div
      className={cx('dd-notice', `dd-notice--${tone}`, className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {icon && <span className="dd-notice__icon" aria-hidden="true">{icon}</span>}
      <div className="dd-notice__text">{children}</div>
      {onClose && (
        <button type="button" className="dd-notice__close" onClick={onClose} aria-label={closeLabel}>
          ×
        </button>
      )}
    </div>
  )
}
