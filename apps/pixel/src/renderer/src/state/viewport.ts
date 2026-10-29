import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'

/**
 * Zoom and position of the picture in the window.
 * screen = canvas * zoom + offset (relative to the viewport element).
 */
export interface Viewport {
  zoom: number
  x: number
  y: number
  /** Size of the visible area in CSS pixels. */
  width: number
  height: number
}

export const ZOOM_MIN = 0.05
export const ZOOM_MAX = 32
const ZOOM_STEPS = [0.05, 0.1, 0.125, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32]

export const viewportStore = createStore<Viewport>({ zoom: 1, x: 0, y: 0, width: 800, height: 600 })

export function useViewport(): Viewport {
  return useSyncExternalStore(viewportStore.subscribe, viewportStore.get)
}

function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

/** Zooms so that the screen point (cx, cy) stays under the mouse. */
export function zoomAt(zoom: number, cx: number, cy: number): void {
  viewportStore.set((view) => {
    const next = clampZoom(zoom)
    const ratio = next / view.zoom
    return { ...view, zoom: next, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio }
  })
}

/** Next bigger or smaller zoom step, around the middle of the view. */
export function zoomStep(direction: 1 | -1, cx?: number, cy?: number): void {
  const view = viewportStore.get()
  const next =
    direction > 0
      ? (ZOOM_STEPS.find((step) => step > view.zoom + 0.001) ?? ZOOM_MAX)
      : ([...ZOOM_STEPS].reverse().find((step) => step < view.zoom - 0.001) ?? ZOOM_MIN)
  zoomAt(next, cx ?? view.width / 2, cy ?? view.height / 2)
}

export function panBy(dx: number, dy: number): void {
  viewportStore.set((view) => ({ ...view, x: view.x + dx, y: view.y + dy }))
}

/** Shows the whole picture, at most at 100 %. */
export function fitToView(docWidth: number, docHeight: number): void {
  viewportStore.set((view) => {
    const margin = 48
    const zoom = clampZoom(Math.min((view.width - margin * 2) / docWidth, (view.height - margin * 2) / docHeight, 1))
    return { ...view, zoom, x: (view.width - docWidth * zoom) / 2, y: (view.height - docHeight * zoom) / 2 }
  })
}

/** 100 %, centered. */
export function actualSize(docWidth: number, docHeight: number): void {
  viewportStore.set((view) => ({ ...view, zoom: 1, x: (view.width - docWidth) / 2, y: (view.height - docHeight) / 2 }))
}

export function setViewportSize(width: number, height: number): void {
  viewportStore.set((view) => (view.width === width && view.height === height ? view : { ...view, width, height }))
}
