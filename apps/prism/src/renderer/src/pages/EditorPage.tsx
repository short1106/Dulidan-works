import { useState } from 'react'
import { ask, Button, Card } from '@dulidan/design-system'
import { addSlide, duplicateSlide, moveSlide, removeSlide, updateSlide, type Layout } from '../../../main/deck'
import { SlideView } from '../components/SlideView'
import { de as t } from '../i18n/de'
import { edit, newPresentation, openDeck, saveDeck, useDeckState } from '../state/deck'

/** Thumbnails on the left, the selected slide and its text on the right. */
export function EditorPage({ onPrint }: { onPrint: () => Promise<void> }): React.JSX.Element {
  const { deck, path, dirty } = useDeckState()
  const [selected, setSelected] = useState(0)
  const index = Math.min(selected, deck.slides.length - 1)
  const slide = deck.slides[index]
  const name = path ? path.split(/[\\/]/).pop() : t.file.untitled

  async function confirmDiscard(): Promise<boolean> {
    return (await ask({
      title: t.file.discardTitle,
      text: t.file.discardText,
      choices: [
        { value: 'ja', label: t.file.discardOk, variant: 'primary' },
        { value: 'nein', label: t.file.keep, variant: 'ghost' }
      ],
      cancelValue: 'nein'
    })) === 'ja'
  }

  return (
    <section aria-labelledby="editor-title" className="prism-page">
      <div className="prism-toolbar prism-no-print">
        <h1 id="editor-title">
          {name} {dirty && <span className="prism-muted">· {t.file.unsaved}</span>}
        </h1>
        <Button onClick={() => void newPresentation(confirmDiscard).then((ok) => ok && setSelected(0))}>{t.file.new}</Button>
        <Button onClick={() => void openDeck(confirmDiscard).then((ok) => ok && setSelected(0))}>{t.file.open}</Button>
        <Button variant="primary" onClick={() => void saveDeck()}>
          {t.file.save}
        </Button>
        <Button onClick={() => void saveDeck(true)}>{t.file.saveAs}</Button>
        <Button onClick={() => void onPrint()}>{t.file.pdf}</Button>
      </div>

      <div className="prism-split">
        <ol className="prism-thumbs prism-no-print" aria-label={t.editor.slides}>
          {deck.slides.map((item, i) => (
            <li key={item.id}>
              <button className="prism-thumb" aria-current={i === index ? 'true' : undefined} onClick={() => setSelected(i)}>
                <span className="prism-thumb-number">{i + 1}</span>
                <span className="prism-thumb-title">{item.title || t.editor.slideTitle}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="prism-editor">
          {slide ? (
            <>
              <div className="prism-preview prism-no-print">
                <SlideView slide={slide} number={index + 1} />
              </div>
              <Card className="prism-card prism-no-print">
                <label>
                  {t.editor.deckTitle}
                  <input value={deck.title} onChange={(event) => edit((d) => ({ ...d, title: event.target.value }))} />
                </label>
                <label>
                  {t.editor.slideTitle}
                  <input value={slide.title} onChange={(event) => edit((d) => updateSlide(d, index, { title: event.target.value }))} />
                </label>
                <label>
                  {t.editor.body}
                  <textarea rows={6} value={slide.body} onChange={(event) => edit((d) => updateSlide(d, index, { body: event.target.value }))} />
                </label>
                <label>
                  {t.editor.layout}
                  <select value={slide.layout} onChange={(event) => edit((d) => updateSlide(d, index, { layout: event.target.value as Layout }))}>
                    <option value="titel">{t.editor.layoutTitle}</option>
                    <option value="inhalt">{t.editor.layoutContent}</option>
                  </select>
                </label>
                <div className="prism-toolbar">
                  <Button onClick={() => edit((d) => addSlide(d, index))}>{t.editor.add}</Button>
                  <Button onClick={() => edit((d) => duplicateSlide(d, index))}>{t.editor.duplicate}</Button>
                  <Button onClick={() => edit((d) => moveSlide(d, index, -1))} disabled={index === 0}>
                    {t.editor.up}
                  </Button>
                  <Button onClick={() => edit((d) => moveSlide(d, index, 1))} disabled={index === deck.slides.length - 1}>
                    {t.editor.down}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={deck.slides.length <= 1}
                    onClick={() => {
                      edit((d) => removeSlide(d, index))
                      setSelected(Math.max(0, index - 1))
                    }}
                  >
                    {t.editor.remove}
                  </Button>
                </div>
                <p className="prism-muted">{t.editor.slideNumber(index + 1, deck.slides.length)}</p>
              </Card>
            </>
          ) : (
            <p>{t.editor.empty}</p>
          )}
        </div>
      </div>
    </section>
  )
}

