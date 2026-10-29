import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'
import type { ShapeKind } from '../engine/shapes'
import type { Rect } from '../engine/geometry'

export type ToolId = 'brush' | 'eraser' | 'fill' | 'shapes' | 'text' | 'picker' | 'crop'

/** Everything the tools need to know: which tool, which color, which sizes. */
export interface ToolState {
  tool: ToolId
  /** Tool to return to after the color picker. */
  previousTool: ToolId
  color: string
  brush: { size: number; hardness: number; opacity: number; smoothing: number }
  eraser: { size: number; hardness: number; opacity: number }
  fill: { tolerance: number; opacity: number }
  shapes: { kind: ShapeKind; width: number; opacity: number; filled: boolean }
  text: { size: number; family: string; bold: boolean; opacity: number }
  /** Rectangle drawn with the crop tool, in canvas pixels. */
  cropRect: Rect | null
}

export const toolStore = createStore<ToolState>({
  tool: 'brush',
  previousTool: 'brush',
  color: '#8122b5',
  brush: { size: 12, hardness: 0.8, opacity: 1, smoothing: 0.4 },
  eraser: { size: 30, hardness: 0.8, opacity: 1 },
  fill: { tolerance: 32, opacity: 1 },
  shapes: { kind: 'rectangle', width: 6, opacity: 1, filled: false },
  text: { size: 48, family: 'Inter', bold: false, opacity: 1 },
  cropRect: null
})

export function useTools(): ToolState {
  return useSyncExternalStore(toolStore.subscribe, toolStore.get)
}

export function setTool(tool: ToolId): void {
  toolStore.set((state) =>
    state.tool === tool ? state : { ...state, tool, previousTool: tool === 'picker' ? state.tool : tool, cropRect: null }
  )
}

export function setColor(color: string): void {
  toolStore.set((state) => ({ ...state, color }))
}

/** Changes one setting of one tool, e.g. updateTool('brush', { size: 20 }). */
export function updateTool<K extends 'brush' | 'eraser' | 'fill' | 'shapes' | 'text'>(tool: K, patch: Partial<ToolState[K]>): void {
  toolStore.set((state) => ({ ...state, [tool]: { ...state[tool], ...patch } }))
}

export function setCropRect(rect: Rect | null): void {
  toolStore.set((state) => ({ ...state, cropRect: rect }))
}

/** The size slider of brush, eraser and shapes, for [ and ] keys. */
export function changeSize(factor: number): void {
  const state = toolStore.get()
  const clamp = (value: number): number => Math.min(400, Math.max(1, Math.round(value)))
  if (state.tool === 'eraser') updateTool('eraser', { size: clamp(state.eraser.size * factor) })
  else if (state.tool === 'shapes') updateTool('shapes', { width: clamp(state.shapes.width * factor) })
  else if (state.tool === 'text') updateTool('text', { size: clamp(state.text.size * factor) })
  else updateTool('brush', { size: clamp(state.brush.size * factor) })
}
