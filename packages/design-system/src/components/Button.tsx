import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Optional icon in front of the label. */
  icon?: ReactNode
}

/** Text button. Primary for the main action of a view, secondary for the rest. */
export function Button({
  variant = 'secondary',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button type={type} className={cx('dd-button', `dd-button--${variant}`, className)} {...rest}>
      {icon && <span className="dd-button__icon" aria-hidden="true">{icon}</span>}
      {children && <span className="dd-button__label">{children}</span>}
    </button>
  )
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode
  /** Always required: read out by screen readers and shown as tooltip. */
  label: string
  /** Show the label as text next to the icon (used in basic mode). */
  showLabel?: boolean
  /** Pressed state for toggles like bold or italic. */
  active?: boolean
  /** Keyboard shortcut shown in the tooltip, e.g. "Strg+B". */
  shortcut?: string
}

/** Icon button for toolbars. Becomes an icon-plus-text button with showLabel. */
export function IconButton({
  icon,
  label,
  showLabel = false,
  active,
  shortcut,
  className,
  type = 'button',
  ...rest
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={cx('dd-icon-button', showLabel && 'dd-icon-button--labeled', active && 'is-active', className)}
      aria-label={showLabel ? undefined : label}
      aria-pressed={active === undefined ? undefined : active}
      title={shortcut ? `${label} (${shortcut})` : label}
      {...rest}
    >
      <span className="dd-icon-button__icon" aria-hidden="true">{icon}</span>
      {showLabel && <span className="dd-icon-button__label">{label}</span>}
    </button>
  )
}
