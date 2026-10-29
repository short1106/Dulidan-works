import { useEffect, useState } from 'react'
import { Button, Dialog, TextField } from '@dulidan/design-system'
import { PIXEL_MAX_SIDE } from '@dulidan/core'
import { changeCanvases, getDoc, useDoc } from '../engine/document'
import { resampleCanvas } from '../engine/io'
import { t } from '../i18n'
import { setUi, useUi } from '../state/ui'
import { fitToView } from '../state/viewport'

/** "Größe ändern": scales the whole picture, all layers at once. */
export function ResizeDialog(): React.JSX.Element {
  const { resizeOpen } = useUi()
  const { doc } = useDoc()
  const [width, setWidth] = useState(String(doc.width))
  const [height, setHeight] = useState(String(doc.height))
  const [keepRatio, setKeepRatio] = useState(true)

  useEffect(() => {
    if (!resizeOpen) return
    setWidth(String(doc.width))
    setHeight(String(doc.height))
  }, [resizeOpen, doc.width, doc.height])

  const ratio = doc.width / doc.height
  const w = Number(width)
  const h = Number(height)
  const valid = Number.isInteger(w) && Number.isInteger(h) && w >= 1 && h >= 1 && w <= PIXEL_MAX_SIDE && h <= PIXEL_MAX_SIDE
  const close = (): void => setUi({ resizeOpen: false })

  const apply = (): void => {
    if (!valid) return
    if (w !== doc.width || h !== doc.height) {
      changeCanvases(t.history.resize, w, h, (layer) => resampleCanvas(layer.canvas, w, h))
      const current = getDoc()
      fitToView(current.width, current.height)
    }
    close()
  }

  return (
    <Dialog
      open={resizeOpen}
      title={t.resize.title}
      onClose={close}
      actions={
        <>
          <Button onClick={close}>{t.dialogs.cancel}</Button>
          <Button variant="primary" disabled={!valid} onClick={apply}>
            {t.resize.apply}
          </Button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault()
          apply()
        }}
      >
        <p>{t.resize.current(doc.width, doc.height)}</p>
        <div className="form-row">
          <TextField
            label={t.resize.width}
            inputMode="numeric"
            value={width}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '')
              setWidth(value)
              if (keepRatio && value) setHeight(String(Math.max(1, Math.round(Number(value) / ratio))))
            }}
          />
          <TextField
            label={t.resize.height}
            inputMode="numeric"
            value={height}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '')
              setHeight(value)
              if (keepRatio && value) setWidth(String(Math.max(1, Math.round(Number(value) * ratio))))
            }}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={keepRatio} onChange={(event) => setKeepRatio(event.target.checked)} />
          {t.resize.keepRatio}
        </label>
        {!valid && <p className="form-error">{t.newCanvas.tooBig(PIXEL_MAX_SIDE)}</p>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
