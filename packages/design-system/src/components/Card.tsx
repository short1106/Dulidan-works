import type { HTMLAttributes } from 'react'
import { cx } from './cx'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** HUD corner brackets on the four corners. */
  corners?: boolean
}

/** Surface with a thin glowing edge, optionally with HUD corner brackets. */
export function Card({ corners = true, className, children, ...rest }: CardProps): React.JSX.Element {
  return (
    <div className={cx('dd-card', className)} {...rest}>
      {corners && <CornerBrackets />}
      {children}
    </div>
  )
}

/** The four HUD corner brackets. Place inside a positioned element. */
export function CornerBrackets(): React.JSX.Element {
  return (
    <>
      <span className="dd-corner dd-corner--tl" aria-hidden="true" />
      <span className="dd-corner dd-corner--tr" aria-hidden="true" />
      <span className="dd-corner dd-corner--bl" aria-hidden="true" />
      <span className="dd-corner dd-corner--br" aria-hidden="true" />
    </>
  )
}
