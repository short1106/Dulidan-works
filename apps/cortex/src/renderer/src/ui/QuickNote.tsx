import { useEffect, useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { ask, Button, DulidanMark, notify, TextField } from '@dulidan/design-system'
import { plainTextToMarkdown } from '@dulidan/notes-core'
import { t } from '../i18n'
import { errorText } from '../state/notes'

/**
 * The small "Schnellnotiz" window (Strg+Umschalt+Leertaste). Saves into
 * the "Posteingang" folder and closes.
 */
export function QuickNote(): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    document.title = `${t.quick.title} – Dulidan Cortex`
    textRef.current?.focus()
  }, [])

  const save = async (): Promise<void> => {
    if (busy) return
    if (!text.trim() && !title.trim()) {
      notify(t.quick.empty, 'info')
      textRef.current?.focus()
      return
    }
    setBusy(true)
    // Without a title, the first line of the text becomes the title.
    const firstLine = text.trim().split('\n')[0]!.trim().slice(0, 60)
    const result = await window.cortex.quickNote.save(title.trim() || firstLine, plainTextToMarkdown(text))
    setBusy(false)
    if (!result.ok) return notify(errorText(result.error), 'error')
    await window.cortex.quickNote.close()
  }

  const cancel = async (): Promise<void> => {
    if (text.trim() || title.trim()) {
      const answer = await ask({
        title: t.quick.title,
        text: t.quick.discardText,
        cancelValue: 'no',
        choices: [
          { value: 'no', label: t.quick.save, variant: 'secondary' },
          { value: 'yes', label: t.quick.discard, variant: 'primary' }
        ]
      })
      if (answer === 'no') return save()
    }
    await window.cortex.quickNote.close()
  }

  return (
    <form
      className="quick-note"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault()
          void save()
        } else if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
          event.preventDefault()
          void cancel()
        }
      }}
    >
      <header className="quick-note__head">
        <DulidanMark size={26} tile title="" />
        <h1 className="quick-note__title">{t.quick.title}</h1>
        <span className="hint">{t.quick.hint}</span>
      </header>
      <TextField label={t.quick.titleLabel} value={title} onChange={(event) => setTitle(event.target.value)} />
      <label className="field quick-note__text">
        <span className="field__label">{t.quick.textLabel}</span>
        <textarea ref={textRef} className="textarea" value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <div className="quick-note__actions">
        <Button variant="ghost" onClick={() => void cancel()}>
          {t.quick.cancel}
        </Button>
        <Button type="submit" variant="primary" icon={<Save />} disabled={busy} title="Strg+Enter">
          {t.quick.save}
        </Button>
      </div>
    </form>
  )
}
