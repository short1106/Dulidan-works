import { useSyncExternalStore } from 'react'
import { notify } from '@dulidan/design-system'
import { createStore } from '@dulidan/core'
import { BrushStroke } from '../engine/brush'
import { sampleColor } from '../engine/compose'
import { activeLayer, changeCanvases, context2d, getDoc, touch, type Layer } from '../engine/document'
import { fillAt } from '../engine/fill'
import { clipRect, constrainPoint, rectFromPoints, type Point } from '../engine/geometry'
import { cropCanvas } from '../engine/io'
import { commitShape, drawShape } from '../engine/shapes'
import { t } from '../i18n'
import { rememberColor } from '../state/settings'
import { setColor, setCropRect, setTool, toolStore } from '../state/tools'

/**
 * What the tools do with the pointer on the canvas.
 * The canvas view converts screen positions to canvas pixels and calls
 * down / move / up. Previews (shapes, crop frame) go on the overlay canvas.
 */
export interface ToolPointer extends Point {
  /** Pen pressure 0..1; mouse and touch use 1. */
  pressure: number
  shift: boolean
  alt: boolean
}

/** Where the text tool is writing right now (canvas pixels). */
export const textEditStore = createStore<Point | null>(null)
export function useTextEdit(): Point | null {
  return useSyncExternalStore(textEditStore.subscribe, textEditStore.get)
}

let overlay: HTMLCanvasElement | null = null
let stroke: BrushStroke | null = null
let dragStart: Point | null = null
let dragEnd: Point | null = null

export function attachOverlay(canvas: HTMLCanvasElement | null): void {
  overlay = canvas
}

function clearOverlay(): void {
  if (!overlay) return
  context2d(overlay).clearRect(0, 0, overlay.width, overlay.height)
}

/** The active layer, or null with a hint if it is hidden. */
function targetLayer(): Layer | null {
  const layer = activeLayer()
  if (!layer) return null
  if (!layer.visible) {
    notify(t.layers.hiddenLayer, 'info')
    return null
  }
  return layer
}

function clampToCanvas(point: Point): Point {
  const doc = getDoc()
  return { x: Math.min(doc.width, Math.max(0, point.x)), y: Math.min(doc.height, Math.max(0, point.y)) }
}

function pickColor(point: Point): void {
  const color = sampleColor(getDoc(), point.x, point.y)
  if (!color) return
  setColor(color)
  rememberColor(color)
}

export function pointerDown(point: ToolPointer): void {
  const state = toolStore.get()
  // Alt + click with brush, shapes, fill or text picks a color, like in other programs.
  if (point.alt && state.tool !== 'eraser' && state.tool !== 'crop') {
    pickColor(point)
    return
  }

  switch (state.tool) {
    case 'brush':
    case 'eraser': {
      const layer = targetLayer()
      if (!layer) return
      const erase = state.tool === 'eraser'
      const settings = erase ? state.eraser : state.brush
      stroke = new BrushStroke(layer, {
        color: state.color,
        size: settings.size,
        hardness: settings.hardness,
        opacity: settings.opacity,
        smoothing: erase ? 0 : state.brush.smoothing,
        erase
      })
      stroke.add(point)
      return
    }
    case 'fill': {
      const layer = targetLayer()
      if (!layer) return
      if (fillAt(layer, point.x, point.y, state.color, state.fill.tolerance, state.fill.opacity, t.history.fill)) {
        rememberColor(state.color)
      }
      return
    }
    case 'picker':
      pickColor(point)
      // Back to the tool used before, so painting can go on at once.
      setTool(state.previousTool === 'picker' ? 'brush' : state.previousTool)
      return
    case 'text':
      // A click while writing just finishes the open text (the field commits on blur).
      if (textEditStore.get() || !targetLayer()) return
      textEditStore.set({ x: point.x, y: point.y })
      return
    case 'shapes':
    case 'crop':
      if (state.tool === 'shapes' && !targetLayer()) return
      dragStart = state.tool === 'crop' ? clampToCanvas(point) : point
      dragEnd = dragStart
      return
  }
}

export function pointerMove(points: ToolPointer[]): void {
  const state = toolStore.get()
  if (stroke) {
    points.forEach((point) => stroke!.add(point))
    return
  }
  if (!dragStart || points.length === 0) return
  const last = points[points.length - 1]!
  let end: Point = state.tool === 'crop' ? clampToCanvas(last) : last
  if (last.shift) end = constrainPoint(dragStart, end, state.tool === 'shapes' && state.shapes.kind === 'line' ? 'line' : 'box')
  dragEnd = end

  if (state.tool === 'shapes' && overlay) {
    clearOverlay()
    drawShape(context2d(overlay), dragStart, end, { ...state.shapes, color: state.color })
  } else if (state.tool === 'crop') {
    setCropRect(rectFromPoints(dragStart, end))
  }
}

export function pointerUp(): void {
  const state = toolStore.get()
  if (stroke) {
    stroke.finish(state.tool === 'eraser' ? t.history.eraser : t.history.brush)
    if (state.tool !== 'eraser') rememberColor(state.color)
    stroke = null
    return
  }
  if (state.tool === 'shapes' && dragStart && dragEnd) {
    clearOverlay()
    const layer = activeLayer()
    const moved = Math.hypot(dragEnd.x - dragStart.x, dragEnd.y - dragStart.y) > 1
    if (layer && moved) {
      commitShape(layer, dragStart, dragEnd, { ...state.shapes, color: state.color }, t.history.shape)
      rememberColor(state.color)
    }
  }
  if (state.tool === 'crop' && dragStart && dragEnd) {
    const rect = rectFromPoints(dragStart, dragEnd)
    setCropRect(rect.width >= 2 && rect.height >= 2 ? rect : null)
  }
  dragStart = null
  dragEnd = null
}

/** Escape during a stroke or drag: undo what was started. */
export function cancelPointer(): void {
  stroke?.cancel()
  stroke = null
  dragStart = null
  dragEnd = null
  clearOverlay()
}

export function isPointerBusy(): boolean {
  return stroke !== null || dragStart !== null
}

/** Cuts the picture to the crop frame. */
export function applyCrop(): void {
  const rect = toolStore.get().cropRect
  const doc = getDoc()
  const area = rect && clipRect(rect, doc.width, doc.height)
  if (!area) return
  changeCanvases(t.history.crop, area.width, area.height, (layer) => cropCanvas(layer.canvas, area.x, area.y, area.width, area.height))
  setCropRect(null)
  touch()
}
