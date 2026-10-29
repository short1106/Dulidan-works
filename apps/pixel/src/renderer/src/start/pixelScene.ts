import { colors, DULIDAN_D, type BootScene, type BootSize } from '@dulidan/design-system'

/**
 * The signature scene of Pixel, about 3 seconds, drawn on one canvas:
 *
 *   1. The Dulidan D stands on the dark HUD grid.
 *   2. It breaks into purple and magenta squares that drift away.
 *   3. A magenta brush stroke paints the D again, with a visible bristle trail.
 *   4. The painted D breaks into pixels once more.
 *   5. The pixels fly together into the word "Pixel", "Dulidan" appears above.
 *
 * Plain squares on a canvas (no SVG elements), so it stays smooth on older
 * computers. The final fade into the app is done by the BootAnimation frame.
 */

const TIMING = {
  standEnd: 450,
  breakStart: 450,
  breakEnd: 1150,
  paintStart: 950,
  paintEnd: 1800,
  reBreakStart: 1850,
  flyStart: 2050,
  flyEnd: 2650,
  brandStart: 2450,
  brandEnd: 2700,
  total: 3000
}

const PALETTE = [colors.primary, colors.accent, '#a12bd0', colors.accentLight]

interface Cell {
  x: number
  y: number
}

interface Particle {
  /** Start position (D cell). */
  home: Cell
  /** Drift direction for the break-up. */
  vx: number
  vy: number
  /** Second break-up offset, before flying to the word. */
  jx: number
  jy: number
  /** Target in the word "Pixel". */
  target: Cell
  color: string
  delay: number
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))
const progress = (time: number, start: number, end: number): number => clamp01((time - start) / (end - start))
const easeOut = (p: number): number => 1 - (1 - p) ** 3
const easeInOut = (p: number): number => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)

/** Deterministic random numbers, so the scene looks the same every start. */
function random(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

/** Cells of a shape drawn on an offscreen canvas, `cell` pixels apart. */
function sampleCells(width: number, height: number, cell: number, paint: (context: CanvasRenderingContext2D) => void): Cell[] {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width)
  canvas.height = Math.ceil(height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return []
  paint(context)
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data
  const cells: Cell[] = []
  for (let y = cell / 2; y < canvas.height; y += cell) {
    for (let x = cell / 2; x < canvas.width; x += cell) {
      if (data[(Math.floor(y) * canvas.width + Math.floor(x)) * 4 + 3]! > 110) cells.push({ x, y })
    }
  }
  return cells
}

/** Points along the outline of the D (in the 100 x 100 logo box), in drawing order. */
function dOutline(): Cell[] {
  const points: Cell[] = []
  const line = (x0: number, y0: number, x1: number, y1: number, steps: number): void => {
    for (let i = 0; i < steps; i++) points.push({ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps })
  }
  line(33, 74, 33, 26, 40)
  line(33, 26, 47, 26, 12)
  // Half circle around (47, 50) with radius 24, from the top over the right to the bottom.
  for (let i = 0; i <= 60; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 60
    points.push({ x: 47 + Math.cos(angle) * 24, y: 50 + Math.sin(angle) * 24 })
  }
  line(47, 74, 33, 74, 12)
  points.push({ x: 33, y: 74 })
  return points
}

export function createPixelScene(): BootScene {
  let scale = 1
  let originX = 0
  let originY = 0
  let cell = 6
  let dCells: Cell[] = []
  let particles: Particle[] = []
  let wordReady = false
  const outline = dOutline()
  const dPath = new Path2D(DULIDAN_D.path)
  const rand = random(42)

  /** Logo box (100 units) to screen pixels. */
  const toScreen = (point: Cell): Cell => ({ x: originX + point.x * scale, y: originY + point.y * scale })

  function buildWord(size: BootSize): void {
    // Wait for Rajdhani, otherwise the word would use a fallback font.
    if (!document.fonts.check('700 100px Rajdhani')) return
    const fontSize = Math.min(size.width * 0.2, size.height * 0.24)
    const width = fontSize * 2.6
    const height = fontSize * 1.1
    const left = size.width / 2 - width / 2
    const top = size.height / 2 - height / 2
    const wordCells = sampleCells(width, height, cell, (context) => {
      context.font = `700 ${fontSize}px Rajdhani`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#ffffff'
      context.fillText('Pixel', width / 2, height / 2)
    }).map((point) => ({ x: point.x + left, y: point.y + top }))
    if (dCells.length === 0 || wordCells.length === 0) return

    particles = wordCells.map((target, index) => {
      const home = dCells[index % dCells.length]!
      const angle = Math.atan2(home.y - size.height / 2, home.x - size.width / 2) + (rand() - 0.5) * 1.2
      const speed = 60 + rand() * 140
      // Purple on the left, magenta on the right of the word.
      const mix = (target.x - left) / width
      return {
        home,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        jx: (rand() - 0.5) * 90,
        jy: (rand() - 0.5) * 90,
        target,
        color: rand() < 0.15 ? colors.accentLight : mix + (rand() - 0.5) * 0.4 < 0.5 ? colors.primary : colors.accent,
        delay: rand() * 0.25
      }
    })
    wordReady = true
  }

  function drawD(context: CanvasRenderingContext2D, alpha: number): void {
    context.save()
    context.globalAlpha = alpha
    context.translate(originX, originY)
    context.scale(scale, scale)
    context.strokeStyle = colors.textOnDark
    context.lineWidth = DULIDAN_D.strokeWidth
    context.lineJoin = 'round'
    context.stroke(dPath)
    const { dot } = DULIDAN_D
    context.fillStyle = colors.accent
    context.fillRect(dot.x, dot.y, dot.size, dot.size)
    context.restore()
  }

  /** The D cells drifting apart (phase 2) or the painted D breaking (phase 4). */
  function drawScatter(context: CanvasRenderingContext2D, p: number, fade: number, palette: string[]): void {
    const travel = easeOut(p)
    dCells.forEach((home, index) => {
      const r1 = ((index * 9301 + 49297) % 233280) / 233280
      const r2 = ((index * 4561 + 12345) % 233280) / 233280
      const angle = Math.atan2(home.y - (originY + 50 * scale), home.x - (originX + 50 * scale)) + (r1 - 0.5) * 1.4
      const distance = (40 + r2 * 160) * travel
      const size = cell * (1 - 0.4 * travel)
      context.globalAlpha = fade * (1 - 0.6 * travel)
      context.fillStyle = palette[index % palette.length]!
      context.fillRect(home.x + Math.cos(angle) * distance - size / 2, home.y + Math.sin(angle) * distance - size / 2, size, size)
    })
    context.globalAlpha = 1
  }

  /** A wide brush painting the D, made of many thin bristle lines. */
  function drawBrush(context: CanvasRenderingContext2D, p: number): void {
    const count = Math.max(2, Math.floor(outline.length * easeInOut(p)))
    const width = DULIDAN_D.strokeWidth * scale * 1.15
    const bristles = 16
    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (let b = 0; b < bristles; b++) {
      const offset = (b / (bristles - 1) - 0.5) * width
      // Uneven bristles: some lighter, some thinner, some shorter.
      const shade = ((b * 37) % 11) / 11
      context.strokeStyle = shade > 0.8 ? colors.accentLight : colors.accent
      context.globalAlpha = 0.45 + shade * 0.5
      context.lineWidth = (width / bristles) * (1.1 + shade * 0.9)
      context.beginPath()
      const lag = Math.floor(shade * 4)
      for (let i = 0; i < count - lag; i++) {
        const point = outline[i]!
        const next = outline[Math.min(outline.length - 1, i + 1)]!
        const tx = next.x - point.x
        const ty = next.y - point.y
        const length = Math.hypot(tx, ty) || 1
        const screen = toScreen(point)
        const x = screen.x + (-ty / length) * offset
        const y = screen.y + (tx / length) * offset
        if (i === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.stroke()
    }
    // Glowing brush head while painting.
    if (p < 1) {
      const head = toScreen(outline[count - 1]!)
      const glow = context.createRadialGradient(head.x, head.y, 0, head.x, head.y, width * 1.4)
      glow.addColorStop(0, 'rgba(245, 184, 242, 0.9)')
      glow.addColorStop(1, 'rgba(192, 32, 184, 0)')
      context.globalAlpha = 1
      context.fillStyle = glow
      context.fillRect(head.x - width * 1.5, head.y - width * 1.5, width * 3, width * 3)
    }
    context.restore()
  }

  return {
    duration: TIMING.total,

    setup(_context, size) {
      const logoSize = Math.min(size.width, size.height) * 0.36
      scale = logoSize / 100
      originX = size.width / 2 - logoSize / 2
      originY = size.height / 2 - logoSize / 2
      cell = Math.max(5, Math.round(Math.min(size.width, size.height) / 100))
      // Cells of the D: the stroke and the small square.
      dCells = sampleCells(logoSize, logoSize, cell, (context) => {
        context.scale(scale, scale)
        context.strokeStyle = '#ffffff'
        context.lineWidth = DULIDAN_D.strokeWidth
        context.lineJoin = 'round'
        context.stroke(new Path2D(DULIDAN_D.path))
        const { dot } = DULIDAN_D
        context.fillStyle = '#ffffff'
        context.fillRect(dot.x, dot.y, dot.size, dot.size)
      }).map((point) => ({ x: point.x + originX, y: point.y + originY }))
      void document.fonts.load('700 100px Rajdhani')
      buildWord(size)
    },

    draw(context, time, size) {
      if (!wordReady) buildWord(size)

      // 1. The D stands.
      if (time < TIMING.standEnd) drawD(context, progress(time, 0, 200))

      // 2. It breaks into squares that drift away.
      if (time >= TIMING.breakStart && time < TIMING.breakEnd) {
        const p = progress(time, TIMING.breakStart, TIMING.breakEnd)
        drawScatter(context, p, 1 - progress(time, TIMING.paintStart + 150, TIMING.breakEnd), PALETTE)
      }

      // 3. A magenta brush paints the D again.
      if (time >= TIMING.paintStart && time < TIMING.reBreakStart) {
        drawBrush(context, progress(time, TIMING.paintStart, TIMING.paintEnd))
      }

      // 4. The painted D breaks into pixels once more.
      if (time >= TIMING.reBreakStart && time < TIMING.flyStart + 60) {
        drawScatter(context, progress(time, TIMING.reBreakStart, TIMING.flyStart) * 0.35, 1, [colors.accent, colors.accentLight, colors.accent])
      }

      // 5. The pixels fly together into "Pixel".
      if (time >= TIMING.flyStart && wordReady) {
        const p = progress(time, TIMING.flyStart, TIMING.flyEnd)
        for (const particle of particles) {
          const local = easeInOut(clamp01((p - particle.delay) / (1 - particle.delay)))
          const startX = particle.home.x + particle.jx
          const startY = particle.home.y + particle.jy
          // A slight curve on the way makes the flight feel alive.
          const curve = Math.sin(local * Math.PI) * 40
          const x = startX + (particle.target.x - startX) * local + particle.vy * 0.15 * (curve / 40)
          const y = startY + (particle.target.y - startY) * local - curve * 0.6
          const sizeNow = cell * (0.6 + 0.4 * local) - 1
          context.fillStyle = particle.color
          context.fillRect(x - sizeNow / 2, y - sizeNow / 2, sizeNow, sizeNow)
        }
        // "Dulidan" small above the word.
        const brand = progress(time, TIMING.brandStart, TIMING.brandEnd)
        if (brand > 0) {
          const fontSize = Math.max(14, Math.min(size.width, size.height) * 0.025)
          context.save()
          context.globalAlpha = brand
          context.fillStyle = colors.accentLight
          context.font = `600 ${fontSize}px Rajdhani`
          context.textAlign = 'center'
          context.letterSpacing = `${(0.1 + 0.5 * easeOut(brand)) * fontSize}px`
          const wordTop = Math.min(...particles.map((item) => item.target.y))
          context.fillText('DULIDAN', size.width / 2, wordTop - fontSize * 1.4)
          context.restore()
        }
      }
    }
  }
}
