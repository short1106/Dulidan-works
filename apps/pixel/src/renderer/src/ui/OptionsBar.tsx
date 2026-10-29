import { Circle, Minus, Square } from 'lucide-react'
import { Button, cx, Slider } from '@dulidan/design-system'
import type { ShapeKind } from '../engine/shapes'
import { t } from '../i18n'
import { applyCrop } from '../tools/controller'
import { setCropRect, updateTool, useTools } from '../state/tools'
import { useMode } from '../state/settings'

export const SHAPE_KINDS: Array<{ kind: ShapeKind; label: string; icon: React.JSX.Element }> = [
  { kind: 'line', label: t.options.line, icon: <Minus /> },
  { kind: 'rectangle', label: t.options.rectangle, icon: <Square /> },
  { kind: 'ellipse', label: t.options.ellipse, icon: <Circle /> }
]

export const FONT_FAMILIES = [
  { label: t.fonts.inter, value: 'Inter' },
  { label: t.fonts.rajdhani, value: 'Rajdhani' },
  { label: t.fonts.serif, value: 'serif' },
  { label: t.fonts.mono, value: 'monospace' }
]

/** Buttons to choose line, rectangle or ellipse. */
export function ShapeChoice({ large }: { large?: boolean }): React.JSX.Element {
  const { shapes } = useTools()
  return (
    <div className={cx('segmented', large && 'segmented--large')} role="radiogroup" aria-label={t.tools.shapes}>
      {SHAPE_KINDS.map(({ kind, label, icon }) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={shapes.kind === kind}
          className={cx('segmented__item', shapes.kind === kind && 'is-selected')}
          onClick={() => updateTool('shapes', { kind })}
        >
          {icon}
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

const percent = (value: number): number => Math.round(value * 100)

/** Settings of the current tool, shown above the canvas. */
export function OptionsBar(): React.JSX.Element {
  const tools = useTools()
  const mode = useMode()
  const basic = mode === 'basic'

  let content: React.ReactNode = null
  switch (tools.tool) {
    case 'brush':
      content = (
        <>
          <Slider label={t.options.size} min={1} max={400} value={tools.brush.size} format={t.options.px} onChange={(size) => updateTool('brush', { size })} />
          {!basic && (
            <>
              <Slider label={t.options.hardness} min={0} max={100} value={percent(tools.brush.hardness)} format={t.options.percent} onChange={(v) => updateTool('brush', { hardness: v / 100 })} />
              <Slider label={t.options.opacity} min={1} max={100} value={percent(tools.brush.opacity)} format={t.options.percent} onChange={(v) => updateTool('brush', { opacity: v / 100 })} />
              <Slider label={t.options.smoothing} min={0} max={100} value={percent(tools.brush.smoothing)} format={t.options.percent} onChange={(v) => updateTool('brush', { smoothing: v / 100 })} />
            </>
          )}
        </>
      )
      break
    case 'eraser':
      content = (
        <>
          <Slider label={t.options.size} min={1} max={400} value={tools.eraser.size} format={t.options.px} onChange={(size) => updateTool('eraser', { size })} />
          {!basic && (
            <>
              <Slider label={t.options.hardness} min={0} max={100} value={percent(tools.eraser.hardness)} format={t.options.percent} onChange={(v) => updateTool('eraser', { hardness: v / 100 })} />
              <Slider label={t.options.opacity} min={1} max={100} value={percent(tools.eraser.opacity)} format={t.options.percent} onChange={(v) => updateTool('eraser', { opacity: v / 100 })} />
            </>
          )}
        </>
      )
      break
    case 'fill':
      content = basic ? null : (
        <>
          <Slider label={t.options.tolerance} min={0} max={128} value={tools.fill.tolerance} onChange={(tolerance) => updateTool('fill', { tolerance })} />
          <Slider label={t.options.opacity} min={1} max={100} value={percent(tools.fill.opacity)} format={t.options.percent} onChange={(v) => updateTool('fill', { opacity: v / 100 })} />
        </>
      )
      break
    case 'shapes':
      content = (
        <>
          <ShapeChoice large={basic} />
          <Slider label={t.options.lineWidth} min={1} max={200} value={tools.shapes.width} format={t.options.px} onChange={(width) => updateTool('shapes', { width })} />
          {tools.shapes.kind !== 'line' && (
            <label className="check">
              <input type="checkbox" checked={tools.shapes.filled} onChange={(event) => updateTool('shapes', { filled: event.target.checked })} />
              {t.options.filled}
            </label>
          )}
          {!basic && (
            <Slider label={t.options.opacity} min={1} max={100} value={percent(tools.shapes.opacity)} format={t.options.percent} onChange={(v) => updateTool('shapes', { opacity: v / 100 })} />
          )}
        </>
      )
      break
    case 'text':
      content = (
        <>
          <Slider label={t.options.fontSize} min={8} max={400} value={tools.text.size} format={t.options.px} onChange={(size) => updateTool('text', { size })} />
          {!basic && (
            <>
              <label className="field-inline">
                <span>{t.options.font}</span>
                <select className="select" value={tools.text.family} onChange={(event) => updateTool('text', { family: event.target.value })}>
                  {FONT_FAMILIES.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={tools.text.bold} onChange={(event) => updateTool('text', { bold: event.target.checked })} />
                {t.options.bold}
              </label>
            </>
          )}
          <span className="options-bar__hint">{t.options.textHint}</span>
        </>
      )
      break
    case 'picker':
      content = <span className="options-bar__hint">{t.options.pickerHint}</span>
      break
    case 'crop':
      content = (
        <>
          <span className="options-bar__hint">{t.options.cropHint}</span>
          <Button variant="primary" disabled={!tools.cropRect} onClick={applyCrop}>
            {t.options.applyCrop}
          </Button>
          <Button disabled={!tools.cropRect} onClick={() => setCropRect(null)}>
            {t.options.cancel}
          </Button>
        </>
      )
      break
  }

  return (
    <div className={cx('options-bar', basic && 'options-bar--basic')} role="group" aria-label={t.options.label}>
      {content}
    </div>
  )
}
