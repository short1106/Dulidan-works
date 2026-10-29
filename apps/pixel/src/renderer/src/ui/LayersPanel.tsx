import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { cx, IconButton, Slider } from '@dulidan/design-system'
import { activeLayer, useDoc, type Layer } from '../engine/document'
import {
  addLayer,
  commitLayerOpacity,
  moveActiveLayer,
  previewLayerOpacity,
  removeActiveLayer,
  renameLayer,
  selectLayer,
  toggleLayerVisibility
} from '../engine/layers'
import { t } from '../i18n'

/** Small preview of a layer, redrawn after every change. */
function Thumbnail({ layer, version }: { layer: Layer; version: number }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const scale = Math.min(48 / layer.canvas.width, 36 / layer.canvas.height)
    canvas.width = Math.max(1, Math.round(layer.canvas.width * scale))
    canvas.height = Math.max(1, Math.round(layer.canvas.height * scale))
    const context = canvas.getContext('2d')
    context?.clearRect(0, 0, canvas.width, canvas.height)
    context?.drawImage(layer.canvas, 0, 0, canvas.width, canvas.height)
  }, [layer, layer.canvas, version])
  return <canvas ref={ref} className="layer-row__thumb" aria-hidden="true" />
}

/** Expert mode: list of layers with visibility, order, opacity and names. */
export function LayersPanel(): React.JSX.Element {
  const { doc, version } = useDoc()
  const active = activeLayer(doc)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [opacity, setOpacity] = useState(active?.opacity ?? 1)
  const opacityStart = useRef(active?.opacity ?? 1)

  useEffect(() => {
    setOpacity(active?.opacity ?? 1)
    opacityStart.current = active?.opacity ?? 1
  }, [active, version])

  const topFirst = doc.layers.slice().reverse()
  const index = doc.layers.findIndex((layer) => layer.id === doc.activeLayerId)

  return (
    <section className="panel layers-panel" aria-labelledby="layers-title">
      <h2 id="layers-title" className="panel__title">
        {t.layers.title}
      </h2>
      <ul className="layers-list" role="listbox" aria-labelledby="layers-title">
        {topFirst.map((layer) => (
          <li key={layer.id} className={cx('layer-row', layer.id === doc.activeLayerId && 'is-active')} role="option" aria-selected={layer.id === doc.activeLayerId}>
            <button
              type="button"
              className="layer-row__eye"
              aria-label={layer.visible ? `${t.layers.hide}: ${layer.name}` : `${t.layers.show}: ${layer.name}`}
              title={layer.visible ? t.layers.hide : t.layers.show}
              onClick={() => toggleLayerVisibility(layer.id)}
            >
              {layer.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </button>
            <Thumbnail layer={layer} version={version} />
            {renaming === layer.id ? (
              <input
                className="layer-row__rename"
                aria-label={t.layers.rename}
                defaultValue={layer.name}
                autoFocus
                onFocus={(event) => event.target.select()}
                onBlur={(event) => {
                  renameLayer(layer.id, event.target.value)
                  setRenaming(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') setRenaming(null)
                }}
              />
            ) : (
              <button
                type="button"
                className="layer-row__name"
                onClick={() => selectLayer(layer.id)}
                onDoubleClick={() => setRenaming(layer.id)}
                onKeyDown={(event) => {
                  if (event.key === 'F2') setRenaming(layer.id)
                }}
                title={`${layer.name} (${t.layers.rename}: Doppelklick oder F2)`}
              >
                <span className={cx(!layer.visible && 'is-hidden')}>{layer.name}</span>
              </button>
            )}
          </li>
        ))}
      </ul>

      {active && (
        <Slider
          label={t.layers.opacity}
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          format={t.options.percent}
          onChange={(value) => {
            setOpacity(value / 100)
            previewLayerOpacity(active.id, value / 100)
          }}
          onCommit={(value) => {
            commitLayerOpacity(active.id, value / 100, opacityStart.current)
            opacityStart.current = value / 100
          }}
        />
      )}

      <div className="layers-panel__actions">
        <IconButton icon={<Plus />} label={t.layers.add} shortcut="Strg+Umschalt+N" onClick={addLayer} />
        <IconButton icon={<ArrowUp />} label={t.layers.up} disabled={index >= doc.layers.length - 1} onClick={() => moveActiveLayer(1)} />
        <IconButton icon={<ArrowDown />} label={t.layers.down} disabled={index <= 0} onClick={() => moveActiveLayer(-1)} />
        <IconButton icon={<Trash2 />} label={t.layers.remove} disabled={doc.layers.length <= 1} onClick={removeActiveLayer} />
      </div>
    </section>
  )
}
