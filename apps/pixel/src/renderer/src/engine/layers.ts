import { notify } from '@dulidan/design-system'
import { t } from '../i18n'
import { changeLayer, changeStack, createLayer, getDoc, touch } from './document'

/** Layer actions of the layer panel and the "Ebene" menu. Each is one undo step. */

export function addLayer(): void {
  const doc = getDoc()
  const numbers = doc.layers.map((layer) => Number(/(\d+)$/.exec(layer.name)?.[1] ?? 0))
  const layer = createLayer(doc.width, doc.height, t.layers.layer(Math.max(0, ...numbers) + 1))
  const index = doc.layers.findIndex((item) => item.id === doc.activeLayerId)
  const layers = doc.layers.slice()
  layers.splice(index + 1, 0, layer)
  changeStack(t.history.addLayer, { layers, activeLayerId: layer.id })
}

export function removeActiveLayer(): void {
  const doc = getDoc()
  if (doc.layers.length <= 1) {
    notify(t.layers.lastLayer, 'info')
    return
  }
  const index = doc.layers.findIndex((item) => item.id === doc.activeLayerId)
  const layers = doc.layers.filter((item) => item.id !== doc.activeLayerId)
  const next = layers[Math.max(0, index - 1)]!
  changeStack(t.history.removeLayer, { layers, activeLayerId: next.id })
}

/** Moves the active layer up (1) or down (-1) in the stack. */
export function moveActiveLayer(direction: 1 | -1): void {
  const doc = getDoc()
  const index = doc.layers.findIndex((item) => item.id === doc.activeLayerId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= doc.layers.length) return
  const layers = doc.layers.slice()
  ;[layers[index], layers[target]] = [layers[target]!, layers[index]!]
  changeStack(t.history.moveLayer, { layers, activeLayerId: doc.activeLayerId })
}

/** Selecting a layer is not an undo step. */
export function selectLayer(id: string): void {
  const doc = getDoc()
  if (doc.activeLayerId === id || !doc.layers.some((layer) => layer.id === id)) return
  doc.activeLayerId = id
  touch()
}

export function toggleLayerVisibility(id: string): void {
  const layer = getDoc().layers.find((item) => item.id === id)
  if (layer) changeLayer(t.history.layerVisibility, layer, 'visible', !layer.visible)
}

/** Live preview while the slider moves, without an undo step. */
export function previewLayerOpacity(id: string, opacity: number): void {
  const layer = getDoc().layers.find((item) => item.id === id)
  if (!layer) return
  layer.opacity = opacity
  layer.canvas.style.opacity = String(opacity)
}

/** Records the opacity change when the slider is released. */
export function commitLayerOpacity(id: string, opacity: number, previous: number): void {
  const layer = getDoc().layers.find((item) => item.id === id)
  if (layer) changeLayer(t.history.layerOpacity, layer, 'opacity', opacity, previous)
}

export function renameLayer(id: string, name: string): void {
  const layer = getDoc().layers.find((item) => item.id === id)
  const trimmed = name.trim().slice(0, 60)
  if (layer && trimmed) changeLayer(t.history.rename, layer, 'name', trimmed)
}
