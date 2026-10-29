import { Brush, Crop, Eraser, PaintBucket, Pipette, Shapes, Type, type LucideIcon } from 'lucide-react'
import { ADVANCED_MODES, ALL_MODES, type Mode, type ModeScoped } from '@dulidan/core'
import { t } from './i18n'
import type { ToolId } from './state/tools'

/**
 * All tools of Pixel, each with the modes it is visible in.
 * Toolbars, menus and keyboard shortcuts are built from this list.
 */
export interface ToolDefinition extends ModeScoped {
  id: ToolId
  label: string
  /** Label in basic mode, if different ("Stift" instead of "Pinsel"). */
  basicLabel?: string
  icon: LucideIcon
  /** Single key that selects the tool. */
  key: string
}

export const TOOLS: ToolDefinition[] = [
  { id: 'brush', label: t.tools.brush, basicLabel: t.tools.pen, icon: Brush, key: 'B', modes: ALL_MODES },
  { id: 'eraser', label: t.tools.eraser, icon: Eraser, key: 'E', modes: ALL_MODES },
  { id: 'fill', label: t.tools.fill, icon: PaintBucket, key: 'G', modes: ALL_MODES },
  { id: 'shapes', label: t.tools.shapes, icon: Shapes, key: 'U', modes: ALL_MODES },
  { id: 'text', label: t.tools.text, icon: Type, key: 'T', modes: ALL_MODES },
  { id: 'picker', label: t.tools.picker, icon: Pipette, key: 'I', modes: ALL_MODES },
  { id: 'crop', label: t.tools.crop, icon: Crop, key: 'C', modes: ADVANCED_MODES }
]

export function toolLabel(tool: ToolDefinition, mode: Mode): string {
  return mode === 'basic' && tool.basicLabel ? tool.basicLabel : tool.label
}

/** Panels and functions beyond the tools, per mode. */
export const FEATURES = {
  layers: { modes: ADVANCED_MODES },
  colorPicker: { modes: ADVANCED_MODES },
  menuBar: { modes: ADVANCED_MODES },
  redo: { modes: ADVANCED_MODES },
  resize: { modes: ADVANCED_MODES },
  april: { modes: ['pro'] as const }
} satisfies Record<string, ModeScoped>
