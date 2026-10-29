import { useEffect, useId, useRef } from 'react'
import { colors, LOGO_GEOMETRY } from '@dulidan/design-system'
import { t } from '../i18n'
import './start.css'

/**
 * The start animation.
 *
 *   full    about 2.2 s: grid, corner brackets, the "G" drawn as a line with
 *           a glowing tip, blinking cursor, DULIDAN / GLYPH, glow pulse
 *   basic   at most 1 s, without grid and brackets
 *   static  for "reduce motion": the still logo, shown briefly
 *
 * Built with SVG and the Web Animations API, no video files.
 * A click or any key skips it.
 */
export type StartVariant = 'full' | 'basic' | 'static'

interface Props {
  variant: StartVariant
  onDone: () => void
}

/** Timings in milliseconds for each variant. */
const TIMELINES = {
  full: { gridIn: [0, 500], cornersIn: [150, 500], logoIn: [300, 300], draw: [500, 900], cursor: [1400, 500], brand: [1300, 500], name: [1500, 400], pulse: [1800, 250], out: [2000, 200] },
  basic: { gridIn: [0, 0], cornersIn: [0, 0], logoIn: [0, 250], draw: [150, 450], cursor: [600, 0], brand: [450, 250], name: [500, 250], pulse: [0, 0], out: [800, 200] },
  static: { gridIn: [0, 0], cornersIn: [0, 0], logoIn: [0, 150], draw: [0, 0], cursor: [0, 0], brand: [0, 150], name: [0, 150], pulse: [0, 0], out: [650, 150] }
} as const

/**
 * Hard on/off steps for a blinking cursor: hidden until `start`, then
 * on, off, on, off ... and finally on. Offsets are relative to start + duration.
 */
function blinkKeyframes(start: number, duration: number, blinks: number): Keyframe[] {
  const total = start + duration
  const step = duration / (blinks * 2 + 1)
  const frames: Keyframe[] = [{ opacity: 0, offset: 0 }]
  for (let i = 0; i <= blinks * 2; i++) {
    const at = (start + i * step) / total
    const visible = i % 2 === 0 ? 1 : 0
    frames.push({ opacity: 1 - visible, offset: at }, { opacity: visible, offset: Math.min(1, at + 0.001) })
  }
  frames.push({ opacity: 1, offset: 1 })
  return frames
}

export function StartAnimation({ variant, onDone }: Props): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const cornersRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const tipRef = useRef<SVGCircleElement>(null)
  const cursorRef = useRef<SVGRectElement>(null)
  const brandRef = useRef<HTMLParagraphElement>(null)
  const nameRef = useRef<HTMLParagraphElement>(null)
  const gradientId = useId()
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const timing = TIMELINES[variant]
    const animations: Animation[] = []
    let finished = false
    let frame = 0

    const finish = (): void => {
      if (finished) return
      finished = true
      cancelAnimationFrame(frame)
      animations.forEach((animation) => animation.cancel())
      doneRef.current()
    }

    function play(
      element: Element | null,
      keyframes: Keyframe[],
      [delay, duration]: readonly [number, number],
      easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
    ): Animation | null {
      if (!element) return null
      const animation = element.animate(keyframes, { delay, duration: Math.max(duration, 1), easing, fill: 'both' })
      animations.push(animation)
      return animation
    }

    // 1. Grid fades in
    if (variant === 'full') play(gridRef.current, [{ opacity: 0 }, { opacity: 1 }], timing.gridIn, 'ease-out')

    // 2. Four corner brackets fly in from outside and snap into place
    if (variant === 'full') {
      cornersRef.current?.querySelectorAll<HTMLElement>('.start__corner').forEach((corner, index) => {
        const x = index % 2 === 0 ? -90 : 90
        const y = index < 2 ? -90 : 90
        play(
          corner,
          [
            { opacity: 0, transform: `translate(${x}px, ${y}px)` },
            { opacity: 1, transform: 'translate(0, 0)', offset: 0.8 },
            { opacity: 1, transform: `translate(${x * -0.04}px, ${y * -0.04}px)`, offset: 0.9 },
            { opacity: 1, transform: 'translate(0, 0)' }
          ],
          [timing.cornersIn[0] + index * 40, timing.cornersIn[1]]
        )
      })
    }

    // Logo square appears
    play(logoRef.current, [{ opacity: 0, transform: 'scale(0.86)' }, { opacity: 1, transform: 'scale(1)' }], timing.logoIn)

    // 3. The "G" is drawn as a line, a glowing tip leads the stroke
    const path = pathRef.current
    if (variant === 'static') {
      tipRef.current?.setAttribute('opacity', '0')
    } else if (path) {
      const draw = play(path, [{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], timing.draw, 'cubic-bezier(0.45, 0, 0.25, 1)')
      const length = path.getTotalLength()
      const followTip = (): void => {
        const offset = parseFloat(getComputedStyle(path).strokeDashoffset) || 0
        const progress = 1 - offset / 100
        const point = path.getPointAtLength(progress * length)
        const tip = tipRef.current
        if (tip) {
          tip.setAttribute('cx', String(point.x))
          tip.setAttribute('cy', String(point.y))
          tip.setAttribute('opacity', progress > 0.01 && progress < 0.995 ? '1' : '0')
        }
        if (draw?.playState !== 'finished') frame = requestAnimationFrame(followTip)
      }
      frame = requestAnimationFrame(followTip)
    }

    // 4. The magenta cursor blinks twice
    if (variant === 'full') {
      const [start, duration] = timing.cursor
      play(cursorRef.current, blinkKeyframes(start, duration, 2), [0, start + duration], 'linear')
    } else if (variant === 'basic') {
      play(cursorRef.current, [{ opacity: 0 }, { opacity: 1 }], [timing.cursor[0], 1])
    }

    // 5. DULIDAN with widening letter spacing, GLYPH below
    play(
      brandRef.current,
      variant === 'static'
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, letterSpacing: '0.05em' },
            { opacity: 1, letterSpacing: '0.6em' }
          ],
      timing.brand
    )
    play(
      nameRef.current,
      variant === 'static' ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      timing.name
    )

    // 6. Glowing edges pulse once, then everything fades into the app
    if (variant === 'full') {
      play(
        logoRef.current,
        [
          { filter: 'drop-shadow(0 0 0 rgba(192, 32, 184, 0))' },
          { filter: 'drop-shadow(0 0 22px rgba(192, 32, 184, 0.9))' },
          { filter: 'drop-shadow(0 0 6px rgba(192, 32, 184, 0.35))' }
        ],
        timing.pulse,
        'ease-in-out'
      )
    }
    play(rootRef.current, [{ opacity: 1 }, { opacity: 0 }], timing.out, 'ease-in')?.finished.then(finish, () => undefined)

    // Click or key skips the animation.
    const skip = (): void => finish()
    window.addEventListener('keydown', skip, { once: true })
    window.addEventListener('pointerdown', skip, { once: true })
    return () => {
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
      cancelAnimationFrame(frame)
      animations.forEach((animation) => animation.cancel())
    }
  }, [variant])

  const { gPath, gStrokeWidth, cursor, corners } = LOGO_GEOMETRY

  return (
    <div ref={rootRef} className={`start start--${variant}`} aria-label={t.start.skipHint} role="presentation">
      {variant === 'full' && <div ref={gridRef} className="start__grid" />}
      <div className="start__stage">
        {variant === 'full' && (
          <div ref={cornersRef} className="start__corners" aria-hidden="true">
            <span className="start__corner start__corner--tl" />
            <span className="start__corner start__corner--tr" />
            <span className="start__corner start__corner--bl" />
            <span className="start__corner start__corner--br" />
          </div>
        )}
        <p ref={brandRef} className="start__brand">
          {t.app.brand}
        </p>
        <svg ref={logoRef} className="start__logo" viewBox="0 0 100 100" aria-hidden="true">
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
            ref={pathRef}
            d={gPath}
            pathLength={100}
            fill="none"
            stroke="#ffffff"
            strokeWidth={gStrokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={100}
            strokeDashoffset={variant === 'static' ? 0 : 100}
          />
          <circle ref={tipRef} className="start__tip" r="4.6" fill="#ffffff" opacity="0" />
          <rect
            ref={cursorRef}
            x={cursor.x}
            y={cursor.y}
            width={cursor.width}
            height={cursor.height}
            rx={cursor.radius}
            fill={colors.accent}
            opacity={variant === 'static' ? 1 : 0}
          />
        </svg>
        <p ref={nameRef} className="start__name">
          {t.app.name}
        </p>
      </div>
      <p className="start__hint">{t.start.skipHint}</p>
    </div>
  )
}
