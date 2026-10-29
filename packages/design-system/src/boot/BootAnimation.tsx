import { useEffect, useRef, type ReactNode } from 'react'
import { DulidanMark } from '../logo/DulidanMark'
import './boot.css'

/**
 * Start animation frame shared by all Dulidan Works apps.
 *
 * The frame does the common work: dark HUD background, skipping by click or
 * key, the short version for basic mode, the still logo for "reduce motion"
 * and the soft fade into the app. Each app brings its own "signature scene"
 * drawn on a canvas; without one, the still logo with the name is shown.
 */

/** full: the signature scene; basic: at most 1 s, logo and name only; static: still logo. */
export type BootVariant = 'full' | 'basic' | 'static'

export interface BootSize {
  width: number
  height: number
}

/** A signature scene, drawn frame by frame on a canvas. */
export interface BootScene {
  /** Length of the scene in milliseconds, the final fade included. */
  duration: number
  /** Prepares the scene for the canvas size (in CSS pixels). */
  setup?(context: CanvasRenderingContext2D, size: BootSize): void
  /** Draws the frame at `time` milliseconds after the start. */
  draw(context: CanvasRenderingContext2D, time: number, size: BootSize): void
}

export interface BootAnimationProps {
  /** Name below the logo, e.g. "Pixel". */
  programName: string
  variant: BootVariant
  onDone: () => void
  /** Signature scene for the full variant. */
  scene?: BootScene
  /** Logo of the still versions, the Dulidan D by default. */
  logo?: ReactNode
  /** Hint at the bottom, e.g. "Klicken oder Taste drücken zum Überspringen". */
  skipHint?: string
}

/** Fade out at the end, in milliseconds. */
const FADE_OUT = 300

const STILL_TIMINGS: Record<BootVariant, { fadeIn: number; hold: number }> = {
  full: { fadeIn: 300, hold: 900 },
  basic: { fadeIn: 200, hold: 400 },
  static: { fadeIn: 0, hold: 700 }
}

export function BootAnimation({ programName, variant, onDone, scene, logo, skipHint }: BootAnimationProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stillRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const useScene = variant === 'full' && !!scene

  useEffect(() => {
    let finished = false
    let frame = 0
    const animations: Animation[] = []
    const finish = (): void => {
      if (finished) return
      finished = true
      cancelAnimationFrame(frame)
      animations.forEach((animation) => animation.cancel())
      doneRef.current()
    }

    let total: number
    if (useScene && scene && canvasRef.current) {
      // Signature scene on a canvas, sharp on high-DPI screens.
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      const ratio = window.devicePixelRatio || 1
      const size = { width: window.innerWidth, height: window.innerHeight }
      canvas.width = Math.round(size.width * ratio)
      canvas.height = Math.round(size.height * ratio)
      total = scene.duration
      if (context) {
        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        scene.setup?.(context, size)
        const start = performance.now()
        const tick = (now: number): void => {
          const time = now - start
          context.clearRect(0, 0, size.width, size.height)
          scene.draw(context, Math.min(time, total), size)
          if (time < total) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      }
    } else {
      // Still logo with name: fade in, hold, fade out.
      const { fadeIn, hold } = STILL_TIMINGS[variant]
      total = fadeIn + hold + FADE_OUT
      if (fadeIn > 0 && stillRef.current) {
        animations.push(
          stillRef.current.animate(
            variant === 'static' ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }],
            { duration: fadeIn, easing: 'ease-out', fill: 'both' }
          )
        )
      }
    }

    // Soft fade into the app at the end.
    const fade = rootRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      delay: total - FADE_OUT,
      duration: FADE_OUT,
      easing: 'ease-in',
      fill: 'forwards'
    })
    if (fade) {
      animations.push(fade)
      fade.finished.then(finish, () => undefined)
    }

    const skip = (): void => finish()
    window.addEventListener('keydown', skip, { once: true })
    window.addEventListener('pointerdown', skip, { once: true })
    return () => {
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
      cancelAnimationFrame(frame)
      animations.forEach((animation) => animation.cancel())
    }
  }, [variant, scene, useScene])

  return (
    <div ref={rootRef} className={`dd-boot dd-boot--${variant}`} role="presentation">
      {variant !== 'basic' && variant !== 'static' && <div className="dd-boot__grid" />}
      {useScene ? (
        <canvas ref={canvasRef} className="dd-boot__canvas" aria-hidden="true" />
      ) : (
        <div ref={stillRef} className="dd-boot__still">
          <p className="dd-boot__brand">Dulidan</p>
          <div className="dd-boot__logo">{logo ?? <DulidanMark size={140} title="" />}</div>
          <p className="dd-boot__name">{programName}</p>
        </div>
      )}
      {skipHint && variant === 'full' && <p className="dd-boot__hint">{skipHint}</p>}
    </div>
  )
}
