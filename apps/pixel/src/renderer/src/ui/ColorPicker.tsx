import { useEffect, useRef, useState } from 'react'
import { cx } from '@dulidan/design-system'
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from '../engine/color'
import { t } from '../i18n'
import { rememberColor, usePrefs } from '../state/settings'
import { setColor, useTools } from '../state/tools'

/** 16 colors that cover most needs. Names in t.color.names. */
export const PALETTE = [
  '#000000', '#4a4453', '#9a93a3', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047',
  '#00acc1', '#1e88e5', '#283593', '#8122b5', '#c020b8', '#f48fb1', '#795548', '#f1c27d'
]

interface SwatchesProps {
  colors: readonly string[]
  current: string
  label: string
  names?: readonly string[]
  large?: boolean
}

/** A row of color buttons. */
export function Swatches({ colors, current, label, names, large }: SwatchesProps): React.JSX.Element {
  return (
    <div className={cx('swatches', large && 'swatches--large')} role="group" aria-label={label}>
      {colors.map((color, index) => (
        <button
          key={color}
          type="button"
          className={cx('swatch', color === current && 'is-selected')}
          style={{ background: color }}
          aria-label={names?.[index] ?? color}
          title={names?.[index] ?? color}
          aria-pressed={color === current}
          onClick={() => {
            setColor(color)
            rememberColor(color)
          }}
        />
      ))}
    </div>
  )
}

/** Full color picker for expert mode: field, hue, code, palette, recent colors. */
export function ColorPicker(): React.JSX.Element {
  const { color } = useTools()
  const { recentColors } = usePrefs()
  // Keep hue and saturation while the color is black or grey.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(color))
  const [hexInput, setHexInput] = useState(color)
  const fieldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hsvToHex(hsv) !== color) setHsv(hexToHsv(color))
    setHexInput(color)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color])

  const apply = (next: Hsv): void => {
    setHsv(next)
    setColor(hsvToHex(next))
  }

  const pickFromField = (clientX: number, clientY: number): void => {
    const bounds = fieldRef.current!.getBoundingClientRect()
    const s = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width))
    const v = 1 - Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height))
    apply({ ...hsv, s, v })
  }

  return (
    <div className="color-picker">
      <div
        ref={fieldRef}
        className="color-picker__field"
        style={{ background: `hsl(${hsv.h} 100% 50%)` }}
        role="slider"
        tabIndex={0}
        aria-label={t.color.field}
        aria-valuetext={color}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          pickFromField(event.clientX, event.clientY)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) pickFromField(event.clientX, event.clientY)
        }}
        onPointerUp={() => rememberColor(color)}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.02
          const moves: Record<string, Partial<Hsv>> = {
            ArrowLeft: { s: Math.max(0, hsv.s - step) },
            ArrowRight: { s: Math.min(1, hsv.s + step) },
            ArrowUp: { v: Math.min(1, hsv.v + step) },
            ArrowDown: { v: Math.max(0, hsv.v - step) }
          }
          const move = moves[event.key]
          if (move) {
            event.preventDefault()
            apply({ ...hsv, ...move })
          }
        }}
      >
        <span className="color-picker__thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: color }} />
      </div>

      <input
        type="range"
        className="color-picker__hue"
        min={0}
        max={359}
        value={Math.round(hsv.h)}
        aria-label={t.color.hue}
        onChange={(event) => apply({ ...hsv, h: Number(event.target.value) })}
        onPointerUp={() => rememberColor(color)}
      />

      <div className="color-picker__row">
        <span className="color-picker__current" style={{ background: color }} aria-label={t.color.current} />
        <input
          className="color-picker__hex"
          aria-label={t.color.hex}
          value={hexInput}
          spellCheck={false}
          onChange={(event) => {
            setHexInput(event.target.value)
            const hex = normalizeHex(event.target.value)
            if (hex) setColor(hex)
          }}
          onBlur={() => {
            setHexInput(color)
            rememberColor(color)
          }}
        />
      </div>

      <p className="panel__subtitle">{t.color.palette}</p>
      <Swatches colors={PALETTE} current={color} label={t.color.palette} names={t.color.names} />

      <p className="panel__subtitle">{t.color.recent}</p>
      {recentColors.length > 0 ? (
        <Swatches colors={recentColors} current={color} label={t.color.recent} />
      ) : (
        <p className="panel__empty">{t.color.noRecent}</p>
      )}
    </div>
  )
}
