import { colors } from '../tokens'

/**
 * Geometry of the Dulidan "D" in a 100 x 100 box. Shared by the logo,
 * app icons and start animations.
 */
export const DULIDAN_D = {
  /** The D as one closed stroke. */
  path: 'M 33 26 V 74 H 47 A 24 24 0 0 0 47 26 Z',
  strokeWidth: 9,
  /** The small square in the middle. */
  dot: { x: 42, y: 45, size: 10 }
} as const

export interface DulidanMarkProps {
  size?: number
  className?: string
  title?: string
  /** Draws the D on a rounded purple square, like an app icon. */
  tile?: boolean
}

/** The Dulidan "D", alone or on a purple tile. */
export function DulidanMark({ size = 64, className, title = 'Dulidan', tile = false }: DulidanMarkProps): React.JSX.Element {
  const { path, strokeWidth, dot } = DULIDAN_D
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
      <path d={path} fill="none" stroke={tile ? '#ffffff' : colors.textOnDark} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <rect
        x={tile ? dot.x + 1 : dot.x}
        y={dot.y}
        width={dot.size}
        height={dot.size}
        rx="1.5"
        fill={tile ? colors.accentLight : colors.accent}
      />
    </svg>
  )
}
