import { useSyncExternalStore } from 'react'
import { createStore, History, PIXEL_MAX_SIDE, type HistoryStep } from '@dulidan/core'
import type { Rect } from './geometry'

/**
 * The open picture: a stack of layers, each with its own canvas.
 * Canvases are changed directly for speed; every change goes through a
 * history step and then calls `touch()` so the UI updates.
 */

export interface Layer {
  id: string
  name: string
  visible: boolean
  /** 0 to 1 */
  opacity: number
  canvas: HTMLCanvasElement
}

export interface PixelDocument {
  width: number
  height: number
  /** Bottom layer first. */
  layers: Layer[]
  activeLayerId: string
}

export type Background = { kind: 'color'; color: string } | { kind: 'transparent' }

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  // willReadFrequently keeps pixels in memory, which makes the fill tool,
  // the color picker and undo much faster.
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D is not available')
  return context
}

let layerCounter = 0
export function newLayerId(): string {
  layerCounter++
  return `layer-${Date.now().toString(36)}-${layerCounter}`
}

export function createLayer(width: number, height: number, name: string): Layer {
  return { id: newLayerId(), name, visible: true, opacity: 1, canvas: createCanvas(width, height) }
}

export function clampSide(value: number): number {
  return Math.min(PIXEL_MAX_SIDE, Math.max(1, Math.round(value)))
}

/** A new picture with one layer "Hintergrund". */
export function createDocument(width: number, height: number, background: Background, layerName: string): PixelDocument {
  const w = clampSide(width)
  const h = clampSide(height)
  const layer = createLayer(w, h, layerName)
  if (background.kind === 'color') {
    const context = context2d(layer.canvas)
    context.fillStyle = background.color
    context.fillRect(0, 0, w, h)
  }
  return { width: w, height: h, layers: [layer], activeLayerId: layer.id }
}

// ---------- Store ----------

interface DocState {
  doc: PixelDocument
  /** Counts every change; the UI and autosave watch it. */
  version: number
}

export const docStore = createStore<DocState>({
  doc: { width: 1, height: 1, layers: [], activeLayerId: '' },
  version: 0
})

export const history = new History({ minSteps: 50, maxSteps: 100, maxBytes: 768 * 1024 * 1024 })

export function getDoc(): PixelDocument {
  return docStore.get().doc
}

/** Tells the UI that the picture changed. */
export function touch(): void {
  docStore.set((state) => ({ ...state, version: state.version + 1 }))
}

export function replaceDocument(doc: PixelDocument): void {
  history.clear()
  docStore.set((state) => ({ doc, version: state.version + 1 }))
}

export function useDoc(): DocState {
  return useSyncExternalStore(docStore.subscribe, docStore.get)
}

export function activeLayer(doc = getDoc()): Layer | undefined {
  return doc.layers.find((layer) => layer.id === doc.activeLayerId)
}

/** Records a step that is already done and updates the UI. */
export function record(step: HistoryStep): void {
  history.push(step)
  touch()
}

export function undo(): void {
  if (history.undo()) touch()
}

export function redo(): void {
  if (history.redo()) touch()
}

// ---------- History steps ----------

/**
 * A pixel change on one layer: only the changed rectangle is kept,
 * before and after. This is what keeps 50+ undo steps small.
 */
export function pixelStep(label: string, layer: Layer, rect: Rect, before: ImageData, after: ImageData): HistoryStep {
  return {
    label,
    bytes: before.data.byteLength + after.data.byteLength,
    undo: () => context2d(layer.canvas).putImageData(before, rect.x, rect.y),
    redo: () => context2d(layer.canvas).putImageData(after, rect.x, rect.y)
  }
}

/** Captures a layer region before a change, returns a function that records the step after it. */
export function beginPixelChange(layer: Layer, rect: Rect): (label: string) => void {
  const context = context2d(layer.canvas)
  const before = context.getImageData(rect.x, rect.y, rect.width, rect.height)
  return (label) => {
    const after = context.getImageData(rect.x, rect.y, rect.width, rect.height)
    record(pixelStep(label, layer, rect, before, after))
  }
}

interface StackState {
  layers: Layer[]
  activeLayerId: string
}

/**
 * A change of the layer stack (add, delete, move). Layers are kept by
 * reference, so no pixels are copied.
 */
export function changeStack(label: string, next: StackState): void {
  const doc = getDoc()
  const before: StackState = { layers: doc.layers.slice(), activeLayerId: doc.activeLayerId }
  const apply = (state: StackState): void => {
    doc.layers = state.layers.slice()
    doc.activeLayerId = state.activeLayerId
  }
  apply(next)
  record({ label, bytes: 64, undo: () => apply(before), redo: () => apply(next) })
}

/** Changes a property of a layer (name, visibility, opacity) as one step. */
export function changeLayer<K extends 'name' | 'visible' | 'opacity'>(label: string, layer: Layer, key: K, value: Layer[K], previous = layer[key]): void {
  if (previous === value) return
  layer[key] = value
  record({
    label,
    bytes: 64,
    undo: () => {
      layer[key] = previous
    },
    redo: () => {
      layer[key] = value
    }
  })
}

/**
 * Replaces size and all layer canvases at once (crop, resize).
 * The old canvases are kept for undo, the new ones for redo.
 */
export function changeCanvases(label: string, width: number, height: number, render: (layer: Layer) => HTMLCanvasElement): void {
  const doc = getDoc()
  const before = { width: doc.width, height: doc.height, canvases: doc.layers.map((layer) => layer.canvas) }
  const layers = doc.layers.slice()
  const after = { width, height, canvases: layers.map((layer) => render(layer)) }
  const apply = (state: typeof before): void => {
    doc.width = state.width
    doc.height = state.height
    layers.forEach((layer, index) => {
      layer.canvas = state.canvases[index]!
    })
  }
  apply(after)
  record({
    label,
    bytes: (before.width * before.height + width * height) * 4 * layers.length,
    undo: () => apply(before),
    redo: () => apply(after)
  })
}
