import { useId } from 'react'
import { cx } from './cx'

export interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  /** Called when the user lets go, e.g. to record one undo step. */
  onCommit?: (value: number) => void
  /** Shown next to the label, e.g. value => `${value} px`. */
  format?: (value: number) => string
  className?: string
  disabled?: boolean
}

/** Labeled slider with the current value. Arrow keys change it step by step. */
export function Slider({ label, value, min, max, step = 1, onChange, onCommit, format, className, disabled }: SliderProps): React.JSX.Element {
  const id = useId()
  const percent = ((value - min) / (max - min)) * 100
  return (
    <div className={cx('dd-slider', className)}>
      <div className="dd-slider__head">
        <label htmlFor={id} className="dd-slider__label">
          {label}
        </label>
        <span className="dd-slider__value">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        className="dd-slider__input"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--dd-slider-fill': `${percent}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={(event) => onCommit?.(Number((event.target as HTMLInputElement).value))}
        onKeyUp={(event) => onCommit?.(Number((event.target as HTMLInputElement).value))}
      />
    </div>
  )
}
