import { useId } from 'react'
import { colors } from '../tokens'

/**
 * Geometry of the Glyph logo in a 100 x 100 box. Shared by the static logo,
 * the start animation and the icon export, so they always match.
 */
export const LOGO_GEOMETRY = {
  /** The "G" as one continuous stroke: arc, then the crossbar inward. */
  gPath: 'M 66.7 31.4 A 25 25 0 1 0 75 52 H 63',
  gStrokeWidth: 9,
  /** The cursor bar the stroke ends in. */
  cursor: { x: 50, y: 39, width: 5.5, height: 26, radius: 2.75 },
  /** HUD corner ticks inside the square. */
  corners: ['M 12 22 V 12 H 22', 'M 78 12 H 88 V 22', 'M 12 78 V 88 H 22', 'M 88 78 V 88 H 78']
} as const

export interface GlyphLogoProps {
  size?: number
  className?: string
  /** Accessible name; pass an empty string if the logo is decorative. */
  title?: string
}

/** The Glyph app logo: gradient square, "G" stroke ending in a cursor. */
export function GlyphLogo({ size = 64, className, title = 'Glyph' }: GlyphLogoProps): React.JSX.Element {
  const gradientId = useId()
  const { gPath, gStrokeWidth, cursor, corners } = LOGO_GEOMETRY
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
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors.primary} />
          <stop offset="1" stopColor={colors.accent} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="96" height="96" rx="22" fill={`url(#${gradientId})`} />
      <g fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round">
        {corners.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path
        d={gPath}
        fill="none"
        stroke="#ffffff"
        strokeWidth={gStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x={cursor.x}
        y={cursor.y}
        width={cursor.width}
        height={cursor.height}
        rx={cursor.radius}
        fill={colors.accentLight}
      />
    </svg>
  )
}
