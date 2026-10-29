import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'
import { useDoc } from '../engine/document'
import type { Point } from '../engine/geometry'
import { t } from '../i18n'
import { attachOverlay, cancelPointer, pointerDown, pointerMove, pointerUp, type ToolPointer } from '../tools/controller'
import { useTools } from '../state/tools'
import { fitToView, panBy, setViewportSize, useViewport, viewportStore, zoomAt } from '../state/viewport'
import { TextEditor } from './TextEditor'
import './canvas.css'

/** Mouse position in canvas pixels, for the status bar. */
export const pointerPositionStore = createStore<Point | null>(null)
export function usePointerPosition(): Point | null {
  return useSyncExternalStore(pointerPositionStore.subscribe, pointerPositionStore.get)
}

/** True while the space bar is held: dragging moves the picture. */
const spaceStore = createStore(false)

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

/**
 * The drawing area. Every layer has its own canvas; they are stacked in a
 * "stage" that is moved and scaled with a CSS transform for zoom and pan.
 */
export function CanvasView(): React.JSX.Element {
  const { doc, version } = useDoc()
  const view = useViewport()
  const tools = useTools()
  const space = useSyncExternalStore(spaceStore.subscribe, spaceStore.get)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const panRef = useRef<{ x: number; y: number } | null>(null)

  // Put the layer canvases into the stage, bottom first.
  useEffect(() => {
    const host = layersRef.current
    if (!host) return
    host.replaceChildren(
      ...doc.layers.map((layer) => {
        layer.canvas.className = 'stage__layer'
        layer.canvas.style.opacity = String(layer.opacity)
        layer.canvas.style.display = layer.visible ? 'block' : 'none'
        layer.canvas.setAttribute('aria-hidden', 'true')
        return layer.canvas
      })
    )
  }, [doc, version])

  // Overlay canvas for previews, same size as the picture.
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.width = doc.width
    overlay.height = doc.height
    attachOverlay(overlay)
    return () => attachOverlay(null)
  }, [doc.width, doc.height])

  // Track the size of the visible area; fit the picture the first time.
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    let first = true
    const observer = new ResizeObserver(() => {
      setViewportSize(element.clientWidth, element.clientHeight)
      if (first) {
        first = false
        fitToView(doc.width, doc.height)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mouse wheel: scroll moves, Ctrl + wheel zooms (non-passive to stop page scrolling).
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const bounds = element.getBoundingClientRect()
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.0025)
        zoomAt(viewportStore.get().zoom * factor, event.clientX - bounds.left, event.clientY - bounds.top)
      } else {
        panBy(-(event.shiftKey ? event.deltaY : event.deltaX), event.shiftKey ? 0 : -event.deltaY)
      }
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  // Space bar held: hand tool. Escape cancels a stroke or drag.
  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      if (event.code === 'Space' && !isTyping(event.target)) {
        event.preventDefault()
        spaceStore.set(true)
      } else if (event.key === 'Escape') {
        cancelPointer()
      }
    }
    const up = (event: KeyboardEvent): void => {
      if (event.code === 'Space') spaceStore.set(false)
    }
    const blur = (): void => spaceStore.set(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  function toCanvas(event: { clientX: number; clientY: number }): Point {
    const bounds = viewportRef.current!.getBoundingClientRect()
    const current = viewportStore.get()
    return { x: (event.clientX - bounds.left - current.x) / current.zoom, y: (event.clientY - bounds.top - current.y) / current.zoom }
  }

  function toolPointer(event: PointerEvent | React.PointerEvent): ToolPointer {
    // Only pens report real pressure; mouse and touch draw at full size.
    const pressure = event.pointerType === 'pen' ? Math.max(0.05, event.pressure || 0.5) : 1
    return { ...toCanvas(event), pressure, shift: event.shiftKey, alt: event.altKey }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button === 2) return
    event.currentTarget.setPointerCapture(event.pointerId)
    // Middle mouse button or space: move the picture.
    if (event.button === 1 || spaceStore.get()) {
      event.preventDefault()
      panRef.current = { x: event.clientX, y: event.clientY }
      setPanning(true)
      return
    }
    if (event.button !== 0) return
    pointerDown(toolPointer(event))
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const bounds = event.currentTarget.getBoundingClientRect()
    setCursor({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })
    const position = toCanvas(event)
    pointerPositionStore.set({ x: Math.floor(position.x), y: Math.floor(position.y) })

    if (panRef.current) {
      panBy(event.clientX - panRef.current.x, event.clientY - panRef.current.y)
      panRef.current = { x: event.clientX, y: event.clientY }
      return
    }
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    // Coalesced events: all positions since the last frame, for smooth lines.
    const native = event.nativeEvent
    const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
    pointerMove((events.length > 0 ? events : [native]).map(toolPointer))
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    if (panRef.current) {
      panRef.current = null
      setPanning(false)
      return
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) pointerUp()
  }

  const brushLike = tools.tool === 'brush' || tools.tool === 'eraser'
  const brushSize = tools.tool === 'eraser' ? tools.eraser.size : tools.brush.size
  const cursorClass = space || panning ? (panning ? 'is-grabbing' : 'is-grab') : `is-${tools.tool}`
  const crop = tools.tool === 'crop' ? tools.cropRect : null

  return (
    <div
      ref={viewportRef}
      className={`canvas-viewport ${cursorClass}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => {
        setCursor(null)
        pointerPositionStore.set(null)
      }}
      onContextMenu={(event) => event.preventDefault()}
      role="application"
      aria-label={t.status.panHint}
    >
      <div
        ref={stageRef}
        className={`stage ${view.zoom >= 2 ? 'is-pixelated' : ''}`}
        style={{ width: doc.width, height: doc.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <div className="stage__checker" />
        <div ref={layersRef} className="stage__layers" />
        <canvas ref={overlayRef} className="stage__overlay" aria-hidden="true" />
      </div>

      {crop && (
        <div
          className="crop-frame"
          style={{ left: view.x + crop.x * view.zoom, top: view.y + crop.y * view.zoom, width: crop.width * view.zoom, height: crop.height * view.zoom }}
        >
          <span className="crop-frame__size">
            {Math.round(crop.width)} × {Math.round(crop.height)}
          </span>
        </div>
      )}

      {brushLike && cursor && !space && !panning && (
        <div
          className="brush-cursor"
          style={{ left: cursor.x, top: cursor.y, width: Math.max(4, brushSize * view.zoom), height: Math.max(4, brushSize * view.zoom) }}
        />
      )}

      <TextEditor />
    </div>
  )
}
