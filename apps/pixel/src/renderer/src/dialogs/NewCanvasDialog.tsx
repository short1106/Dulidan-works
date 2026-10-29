import { useEffect, useState } from 'react'
import { Button, Dialog, TextField } from '@dulidan/design-system'
import { PIXEL_MAX_SIDE } from '@dulidan/core'
import { t } from '../i18n'
import { newPicture } from '../state/session'
import { setUi, useUi } from '../state/ui'

const PRESETS = [
  { id: 'screen', width: 1920, height: 1080 },
  { id: 'square', width: 1080, height: 1080 },
  { id: 'a4', width: 2480, height: 3508 },
  { id: 'postcard', width: 1748, height: 1240 }
] as const

type BackgroundChoice = 'white' | 'transparent' | 'color'

export function NewCanvasDialog(): React.JSX.Element {
  const { newOpen } = useUi()
  const [width, setWidth] = useState('1920')
  const [height, setHeight] = useState('1080')
  const [background, setBackground] = useState<BackgroundChoice>('white')
  const [color, setColor] = useState('#f3eaff')

  useEffect(() => {
    if (newOpen) setBackground('white')
  }, [newOpen])

  const w = Number(width)
  const h = Number(height)
  const valid = Number.isInteger(w) && Number.isInteger(h) && w >= 1 && h >= 1 && w <= PIXEL_MAX_SIDE && h <= PIXEL_MAX_SIDE
  const preset = PRESETS.find((item) => item.width === w && item.height === h)?.id ?? 'custom'
  const close = (): void => setUi({ newOpen: false })

  const create = async (): Promise<void> => {
    if (!valid) return
    close()
    await newPicture(w, h, background === 'transparent' ? { kind: 'transparent' } : { kind: 'color', color: background === 'white' ? '#ffffff' : color })
  }

  return (
    <Dialog
      open={newOpen}
      title={t.newCanvas.title}
      onClose={close}
      actions={
        <>
          <Button onClick={close}>{t.dialogs.cancel}</Button>
          <Button variant="primary" disabled={!valid} onClick={() => void create()}>
            {t.newCanvas.create}
          </Button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault()
          void create()
        }}
      >
        <label className="field-inline field-inline--stacked">
          <span>{t.newCanvas.presets}</span>
          <select
            className="select"
            value={preset}
            onChange={(event) => {
              const chosen = PRESETS.find((item) => item.id === event.target.value)
              if (chosen) {
                setWidth(String(chosen.width))
                setHeight(String(chosen.height))
              }
            }}
          >
            {PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {t.newCanvas.presetNames[item.id]}
              </option>
            ))}
            <option value="custom">{t.newCanvas.presetNames.custom}</option>
          </select>
        </label>
        <div className="form-row">
          <TextField label={t.newCanvas.width} inputMode="numeric" value={width} onChange={(event) => setWidth(event.target.value.replace(/\D/g, ''))} />
          <TextField label={t.newCanvas.height} inputMode="numeric" value={height} onChange={(event) => setHeight(event.target.value.replace(/\D/g, ''))} />
        </div>
        {!valid && <p className="form-error">{t.newCanvas.tooBig(PIXEL_MAX_SIDE)}</p>}
        <fieldset className="choice-group">
          <legend>{t.newCanvas.background}</legend>
          {(['white', 'transparent', 'color'] as const).map((choice) => (
            <label key={choice} className="check">
              <input type="radio" name="background" checked={background === choice} onChange={() => setBackground(choice)} />
              {t.newCanvas[choice]}
            </label>
          ))}
          {background === 'color' && (
            <input type="color" className="color-input" value={color} aria-label={t.newCanvas.color} onChange={(event) => setColor(event.target.value)} />
          )}
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
