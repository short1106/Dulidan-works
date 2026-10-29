import { Paperclip, Send, X } from 'lucide-react'
import { Button, IconButton, notify, TextField } from '@dulidan/design-system'
import { RichTextEditor } from '@dulidan/editor'
import { can } from '../features'
import { t } from '../i18n'
import { closeCompose, MAX_ATTACHMENT_BYTES, saveDraft, sendCompose, updateCompose, useCompose } from '../state/compose'
import { useAccounts, useMode } from '../state/settings'

function readFile(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((buffer) => new Uint8Array(buffer))
}

/** Writing a mail: recipients, subject, the lean editor, attachments. */
export function Composer(): React.JSX.Element | null {
  const state = useCompose()
  const accounts = useAccounts()
  const mode = useMode()
  const basic = mode === 'basic'
  if (!state.open) return null
  const title = state.kind === 'forward' ? t.compose.forwardTitle : state.kind === 'new' ? t.compose.title : t.compose.replyTitle

  const addAttachments = async (files: FileList | null): Promise<void> => {
    if (!files) return
    const added = await Promise.all(
      Array.from(files).map(async (file) => ({ filename: file.name, contentType: file.type || 'application/octet-stream', content: await readFile(file) }))
    )
    const next = [...state.attachments, ...added]
    if (next.reduce((sum, item) => sum + item.content.length, 0) > MAX_ATTACHMENT_BYTES) notify(t.compose.tooBig, 'error')
    updateCompose({ attachments: next })
  }

  return (
    <section
      className="composer"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          void sendCompose()
        }
        if (event.key === 'Escape') void closeCompose()
      }}
    >
      <header className="composer__head">
        <h2>{title}</h2>
        <IconButton icon={<X />} label={t.compose.close} onClick={() => void closeCompose()} />
      </header>

      <div className="composer__fields">
        {accounts.length > 1 && (
          <label className="composer__from">
            <span>{t.compose.from}</span>
            <select className="select" value={state.accountId} onChange={(event) => updateCompose({ accountId: event.target.value })}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName ? `${account.displayName} <${account.email}>` : account.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <TextField label={t.compose.to} value={state.to} placeholder={t.compose.addressHint} autoFocus={!state.to} onChange={(event) => updateCompose({ to: event.target.value })} />
        {can('ccBcc', mode) && !state.showCc && (
          <button type="button" className="composer__link" onClick={() => updateCompose({ showCc: true })}>
            {t.compose.showCc}
          </button>
        )}
        {can('ccBcc', mode) && state.showCc && (
          <>
            <TextField label={t.compose.cc} value={state.cc} onChange={(event) => updateCompose({ cc: event.target.value })} />
            <TextField label={t.compose.bcc} value={state.bcc} onChange={(event) => updateCompose({ bcc: event.target.value })} />
          </>
        )}
        <TextField label={t.compose.subject} value={state.subject} onChange={(event) => updateCompose({ subject: event.target.value })} />
      </div>

      <RichTextEditor
        key={state.editorKey}
        className="composer__editor"
        initialHtml={state.initialHtml}
        showLabels={basic}
        autofocus={!!state.to}
        onChange={(html, text) => updateCompose({ html, text })}
      />

      {state.attachments.length > 0 && (
        <ul className="composer__attachments" aria-label={t.reader.attachments}>
          {state.attachments.map((item, index) => (
            <li key={`${item.filename}-${index}`} className="chip">
              <Paperclip aria-hidden="true" />
              <span>{item.filename}</span>
              <button
                type="button"
                className="chip__remove"
                aria-label={t.compose.removeAttachment(item.filename)}
                onClick={() => updateCompose({ attachments: state.attachments.filter((_, i) => i !== index) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="composer__actions">
        <Button variant="primary" icon={<Send />} disabled={state.sending} onClick={() => void sendCompose()}>
          {state.sending ? t.compose.sending : t.compose.send}
        </Button>
        <label className="dd-button dd-button--secondary composer__attach">
          <Paperclip aria-hidden="true" />
          <span>{t.compose.attach}</span>
          <input type="file" multiple className="dd-visually-hidden" onChange={(event) => void addAttachments(event.target.files).then(() => (event.target.value = ''))} />
        </label>
        {can('drafts', mode) && <Button onClick={() => void saveDraft()}>{t.compose.saveDraft}</Button>}
        <span className="toolbar__spacer" />
        <Button variant="ghost" onClick={() => void closeCompose()}>
          {t.compose.discard}
        </Button>
      </footer>
    </section>
  )
}
