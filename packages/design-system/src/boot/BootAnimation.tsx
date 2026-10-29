import { useEffect, useRef, useState } from 'react'
import { colors } from '../tokens'
import { DULIDAN_D } from '../logo/DulidanMark'
import './boot.css'

/**
 * Start animation shared by all Dulidan Works apps. Each app only passes its
 * name: the D is drawn, a cursor blinks and types "Dulidan <programName>".
 *
 *   full    about 4.3 s: grid, D drawn with a glowing tip, cursor blinks
 *           three times, types the name, blinks once more, glow pulse, fade out
 *   basic   at most 1 s: D and name appear at once, no grid, no typing
 *   static  for "reduce motion": the still logo with the name, shown briefly
 *
 * An app may pass its own `scene` (canvas) for the full variant instead,
 * like Pixel does. Click or any key skips the animation.
 */
export type BootVariant = 'full' | 'basic' | 'static'

export interface BootSize {
  width: number
  height: number
}

/** A signature scene drawn frame by frame on a canvas (optional). */
export interface BootScene {
  /** Length of the scene in milliseconds, the final fade included. */
  duration: number
  setup?(context: CanvasRenderingContext2D, size: BootSize): void
  draw(context: CanvasRenderingContext2D, time: number, size: BootSize): void
}

export interface BootAnimationProps {
  /** Name after "Dulidan", e.g. "Glyph". */
  programName: string
  variant: BootVariant
  onDone: () => void
  /** Own canvas scene for the full variant instead of the typing animation. */
  scene?: BootScene
  /** Hint at the bottom, e.g. "Klicken oder Taste drücken zum Überspringen". */
  skipHint?: string
}

/** Timings of the full typing animation, in milliseconds. */
export const BOOT_TIMING = {
  gridFadeIn: 600,
  drawStart: 150,
  drawDuration: 800,
  /** One calm blink: visible half, hidden half. */
  blinkCycle: 530,
  blinksBefore: 3,
  letterMin: 30,
  letterMax: 110,
  pulse: 450,
  fadeOut: 300
} as const

const BRAND = 'Dulidan'

export function BootAnimation({ programName, variant, onDone, scene, skipHint }: BootAnimationProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lockupRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const tipRef = useRef<SVGCircleElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const text = `${BRAND} ${programName}`
  const useScene = variant === 'full' && !!scene
  const typing = variant === 'full' && !scene
  const [typed, setTyped] = useState(typing ? 0 : text.length)

  useEffect(() => {
    let alive = true
    let finished = false
    let frame = 0
    const timers: number[] = []
    const animations: Animation[] = []

    const finish = (): void => {
      if (finished) return
      finished = true
      alive = false
      doneRef.current()
    }
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => timers.push(window.setTimeout(resolve, ms)))
    const animate = (element: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | null => {
      if (!element) return null
      const animation = element.animate(keyframes, { fill: 'both', ...options })
      animations.push(animation)
      return animation
    }
    const fadeOut = async (): Promise<void> => {
      await animate(rootRef.current, [{ opacity: 1 }, { opacity: 0 }], { duration: BOOT_TIMING.fadeOut, easing: 'ease-in' })?.finished.catch(() => undefined)
      if (alive) finish()
    }
    const setCursor = (visible: boolean): void => {
      if (cursorRef.current) cursorRef.current.style.opacity = visible ? '1' : '0'
    }
    const blink = async (times: number): Promise<void> => {
      for (let i = 0; i < times && alive; i++) {
        await sleep(BOOT_TIMING.blinkCycle / 2)
        setCursor(false)
        await sleep(BOOT_TIMING.blinkCycle / 2)
        setCursor(true)
      }
    }

    async function runTyping(): Promise<void> {
      setTyped(0)
      setCursor(false)
      // 1. The HUD grid fades in quietly.
      animate(gridRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: BOOT_TIMING.gridFadeIn, easing: 'ease-out' })

      // 2. The D is drawn as one line, a glowing tip leads the stroke.
      const path = pathRef.current
      const draw = animate(path, [{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], {
        delay: BOOT_TIMING.drawStart,
        duration: BOOT_TIMING.drawDuration,
        easing: 'cubic-bezier(0.45, 0, 0.25, 1)'
      })
      if (path && draw) {
        const length = path.getTotalLength()
        const follow = (): void => {
          const progress = 1 - (parseFloat(getComputedStyle(path).strokeDashoffset) || 0) / 100
          const point = path.getPointAtLength(progress * length)
          const tip = tipRef.current
          if (tip) {
            tip.setAttribute('cx', String(point.x))
            tip.setAttribute('cy', String(point.y))
            tip.setAttribute('opacity', progress > 0.01 && progress < 0.995 ? '1' : '0')
          }
          if (alive && draw.playState !== 'finished') frame = requestAnimationFrame(follow)
        }
        frame = requestAnimationFrame(follow)
        await draw.finished.catch(() => undefined)
      }
      if (!alive) return

      // 3. The magenta cursor appears right of the D and blinks calmly three times.
      setCursor(true)
      await blink(BOOT_TIMING.blinksBefore)

      // 4. It types "Dulidan <name>" letter by letter, with uneven gaps like real typing.
      for (let count = 1; count <= text.length && alive; count++) {
        setTyped(count)
        await sleep(BOOT_TIMING.letterMin + Math.random() * (BOOT_TIMING.letterMax - BOOT_TIMING.letterMin))
      }
      if (!alive) return

      // 5. One more blink, the glowing edges pulse once, then fade into the app.
      animate(
        lockupRef.current,
        [
          { filter: 'drop-shadow(0 0 0 rgba(192, 32, 184, 0))' },
          { filter: 'drop-shadow(0 0 20px rgba(192, 32, 184, 0.9))' },
          { filter: 'drop-shadow(0 0 4px rgba(192, 32, 184, 0.3))' }
        ],
        { duration: BOOT_TIMING.pulse, easing: 'ease-in-out' }
      )
      await blink(1)
      if (alive) await fadeOut()
    }

    async function runStill(): Promise<void> {
      // basic: fade in, hold, fade out, under one second. static: no motion at all.
      if (variant === 'basic') {
        animate(lockupRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' })
        await sleep(150 + 450)
      } else {
        await sleep(700)
      }
      if (alive) await fadeOut()
    }

    async function runScene(): Promise<void> {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context || !scene) return finish()
      animate(gridRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: BOOT_TIMING.gridFadeIn, easing: 'ease-out' })
      const ratio = window.devicePixelRatio || 1
      const size = { width: window.innerWidth, height: window.innerHeight }
      canvas.width = Math.round(size.width * ratio)
      canvas.height = Math.round(size.height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      scene.setup?.(context, size)
      const start = performance.now()
      const tick = (now: number): void => {
        const time = Math.min(now - start, scene.duration)
        context.clearRect(0, 0, size.width, size.height)
        scene.draw(context, time, size)
        if (alive && time < scene.duration) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      await sleep(scene.duration - BOOT_TIMING.fadeOut)
      if (alive) await fadeOut()
    }

    void (useScene ? runScene() : typing ? runTyping() : runStill())

    const skip = (): void => finish()
    window.addEventListener('keydown', skip, { once: true })
    window.addEventListener('pointerdown', skip, { once: true })
    return () => {
      alive = false
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
      cancelAnimationFrame(frame)
      timers.forEach((timer) => clearTimeout(timer))
      animations.forEach((animation) => animation.cancel())
    }
  }, [variant, scene, useScene, typing, text])

  const letters = text.slice(0, typed).split('')

  return (
    <div ref={rootRef} className={`dd-boot dd-boot--${variant}`} role="presentation">
      {variant === 'full' && <div ref={gridRef} className="dd-boot__grid" />}
      {useScene ? (
        <canvas ref={canvasRef} className="dd-boot__canvas" aria-hidden="true" />
      ) : (
        <div ref={lockupRef} className="dd-boot__lockup" aria-label={text}>
          <svg className="dd-boot__mark" viewBox="-8 -8 116 116" aria-hidden="true">
            <path
              ref={pathRef}
              d={DULIDAN_D.path}
              pathLength={100}
              fill="none"
              stroke={colors.textOnDark}
              strokeWidth={DULIDAN_D.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={100}
              strokeDashoffset={typing ? 100 : 0}
            />
            <circle ref={tipRef} className="dd-boot__tip" r="5" fill="#ffffff" opacity="0" />
          </svg>
          <p className="dd-boot__word" aria-hidden="true">
            {/* Invisible full text keeps the width, so the D does not move while typing. */}
            <span className="dd-boot__ghost">
              {text}
              <span className="dd-boot__cursor-space" />
            </span>
            <span className="dd-boot__typed">
              {letters.map((letter, index) => (
                <span key={index} className={index < BRAND.length ? 'dd-boot__brand' : 'dd-boot__program'}>
                  {letter}
                </span>
              ))}
              {typing && <span ref={cursorRef} className="dd-boot__cursor" />}
            </span>
          </p>
        </div>
      )}
      {skipHint && variant === 'full' && <p className="dd-boot__hint">{skipHint}</p>}
    </div>
  )
}
