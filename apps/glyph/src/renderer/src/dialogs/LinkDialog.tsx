import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Button, Dialog, TextField } from '@dulidan/design-system'
import { t } from '../i18n'
import { setUi, useUi } from '../state/ui'

const ALLOWED = /^(https?:\/\/|mailto:)/i

/** Adds "https://" to "dulidan.de", keeps complete addresses. */
export function normalizeUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (ALLOWED.test(value)) return value
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(value)) return `mailto:${value}`
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(value)) return `https://${value}`
  return null
}

export function LinkDialog({ editor }: { editor: Editor }): React.JSX.Element {
  const { linkOpen } = useUi()
  const [url, setUrl] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!linkOpen) return
    setUrl((editor.getAttributes('link')['href'] as string | undefined) ?? '')
    setError(false)
  }, [linkOpen, editor])

  const close = (): void => {
    setUi({ linkOpen: false })
    editor.commands.focus()
  }

  const apply = (): void => {
    const href = normalizeUrl(url)
    if (!href) {
      setError(true)
      return
    }
    const chain = editor.chain().focus().extendMarkRange('link')
    if (editor.state.selection.empty && !editor.isActive('link')) {
      // Nothing selected: insert the address itself as linked text.
      chain.insertContent({ type: 'text', text: url.trim(), marks: [{ type: 'link', attrs: { href } }] }).run()
    } else {
      chain.setLink({ href }).run()
    }
    setUi({ linkOpen: false })
  }

  return (
    <Dialog
      open={linkOpen}
      title={t.link.title}
      onClose={close}
      actions={
        <>
          {editor.isActive('link') && (
            <Button
              variant="ghost"
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run()
                setUi({ linkOpen: false })
              }}
            >
              {t.link.remove}
            </Button>
          )}
          <Button onClick={close}>{t.dialogs.cancel}</Button>
          <Button variant="primary" onClick={apply}>
            {t.link.apply}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          apply()
        }}
      >
        <TextField
          label={t.link.url}
          value={url}
          autoFocus
          onChange={(event) => {
            setUrl(event.target.value)
            setError(false)
          }}
          aria-invalid={error}
        />
        {error && <p className="link-dialog__error">{t.link.invalid}</p>}
      </form>
    </Dialog>
  )
}
