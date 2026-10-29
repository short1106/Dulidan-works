import { colors } from '../tokens'

/**
 * Geometry of the Dulidan "D", the mark of Dulidan Studios, in a 100 x 100
 * box. One open stroke: up the back, over the bowl, back along the bottom,
 * ending just before its start. Shared by logo, app icons and animations.
 */
export const DULIDAN_D = {
  path: 'M 33 64 V 26 H 47 A 24 24 0 0 1 47 74 H 33',
  strokeWidth: 9,
  /** End of the stroke, where e.g. a cursor can continue. */
  end: { x: 33, y: 74 }
} as const

export interface DulidanMarkProps {
  size?: number
  className?: string
  title?: string
  /** Draws the D on a rounded purple square, like the app icon. */
  tile?: boolean
}

/** The Dulidan "D", alone or on a purple tile. */
export function DulidanMark({ size = 64, className, title = 'Dulidan', tile = false }: DulidanMarkProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
    >
      {tile && <rect x="2" y="2" width="96" height="96" rx="22" fill={colors.primary} />}
      <path
        d={DULIDAN_D.path}
        fill="none"
        stroke={tile ? '#ffffff' : colors.textOnDark}
        strokeWidth={DULIDAN_D.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
