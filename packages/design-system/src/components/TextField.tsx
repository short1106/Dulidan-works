import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cx } from './cx'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Hide the label visually but keep it for screen readers. */
  hideLabel?: boolean
}

/** Input field with a label that is always connected for accessibility. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel, className, id, ...rest },
  ref
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={cx('dd-field', className)}>
      <label htmlFor={inputId} className={cx('dd-field__label', hideLabel && 'dd-visually-hidden')}>
        {label}
      </label>
      <input ref={ref} id={inputId} className="dd-field__input" {...rest} />
    </div>
  )
})
