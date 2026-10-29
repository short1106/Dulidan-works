import { useState } from 'react'
import { CalendarPlus, Download, Eye, Forward, Mail, Paperclip, Reply, ReplyAll, Sparkles, Trash2 } from 'lucide-react'
import { Button, Dialog, IconButton, notify, Toolbar } from '@dulidan/design-system'
import type { AttachmentInfo, MessageDetail } from '../../../shared/ipc'
import { can } from '../features'
import { t } from '../i18n'
import { displayName } from '../mail/addresses'
import { formatMailDate } from '../mail/quote'
import { openCompose } from '../state/compose'
import { errorText, markUnread, moveToTrash, useMail } from '../state/mail'
import { useMode } from '../state/settings'
import { MailBody } from './MailBody'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

function AttachmentRow({ mail, attachment }: { mail: MessageDetail; attachment: AttachmentInfo }): React.JSX.Element {
  const [preview, setPreview] = useState<string | null>(null)
  const isImage = /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(attachment.contentType)
  const isCalendar = attachment.contentType === 'text/calendar' || /\.ics$/i.test(attachment.filename)
  return (
    <li className="attachment">
      <Paperclip aria-hidden="true" />
      <span className="attachment__name">
        {attachment.filename} <small>({formatSize(attachment.size)})</small>
      </span>
      {isImage && (
        <Button
          icon={<Eye />}
          onClick={async () => {
            const result = await window.relay.mail.previewAttachment(mail.id, attachment.index)
            if (result.ok) setPreview(result.value)
            else notify(errorText(result.error), 'error')
          }}
        >
          {t.reader.view}
        </Button>
      )}
      {isCalendar && (
        <Button
          icon={<CalendarPlus />}
          onClick={async () => {
            const result = await window.relay.mail.importIcsAttachment(mail.id, attachment.index)
            if (!result.ok) return notify(errorText(result.error), 'error')
            notify(t.reader.imported(result.value.added, result.value.updated), 'success')
            if (result.value.simplified.length > 0) notify(t.reader.simplified(result.value.simplified.join(', ')), 'info')
          }}
        >
          {t.reader.importCalendar}
        </Button>
      )}
      <Button
        icon={<Download />}
        onClick={async () => {
          const result = await window.relay.mail.saveAttachment(mail.id, attachment.index)
          if (!result.ok) notify(errorText(result.error), 'error')
          else if (result.value) notify(t.reader.saved, 'success')
        }}
      >
        {t.reader.save}
      </Button>
      {preview && (
        <Dialog open title={attachment.filename} onClose={() => setPreview(null)} actions={<Button onClick={() => setPreview(null)}>{t.dialogs.close}</Button>}>
          <img className="attachment__preview" src={preview} alt={attachment.filename} />
        </Dialog>
      )}
    </li>
  )
}

/** Pro mode: April placeholder next to the mail. Nothing is sent anywhere. */
function AprilBox(): React.JSX.Element {
  return (
    <aside className="april-box" aria-label={t.april.title}>
      <div className="april-box__head">
        <Sparkles aria-hidden="true" />
        <strong>{t.april.title}</strong>
        <span className="april-box__badge">{t.april.comingSoon}</span>
      </div>
      <p>{t.april.text}</p>
      <div className="april-box__actions">
        <Button disabled>{t.april.summarize}</Button>
        <Button disabled>{t.april.suggest}</Button>
      </div>
    </aside>
  )
}

export function Reader(): React.JSX.Element {
  const { detail, loadingDetail, folders } = useMail()
  const mode = useMode()
  const basic = mode === 'basic'
  if (loadingDetail) return <section className="reader reader--empty">{t.reader.loading}</section>
  if (!detail) return <section className="reader reader--empty">{t.reader.empty}</section>

  const inTrash = folders[detail.accountId]?.some((folder) => folder.path === detail.folder && folder.specialUse === 'trash') ?? false
  const files = detail.attachments.filter((item) => !item.inline)

  return (
    <section className="reader" aria-label={detail.subject || t.list.noSubject}>
      <Toolbar label={t.reader.reply} className="reader__actions">
        <IconButton icon={<Reply />} label={t.reader.reply} showLabel onClick={() => void openCompose('reply', detail)} />
        {can('replyAll', mode) && <IconButton icon={<ReplyAll />} label={t.reader.replyAll} showLabel={!basic} onClick={() => void openCompose('replyAll', detail)} />}
        {can('forward', mode) && <IconButton icon={<Forward />} label={t.reader.forward} showLabel={!basic} onClick={() => void openCompose('forward', detail)} />}
        {can('markUnread', mode) && <IconButton icon={<Mail />} label={t.reader.markUnread} onClick={() => void markUnread(detail.id)} />}
        {!inTrash && <IconButton icon={<Trash2 />} label={t.reader.trash} showLabel onClick={() => void moveToTrash(detail.id)} />}
      </Toolbar>

      <header className="reader__head">
        <h2 className="reader__subject">{detail.subject || t.list.noSubject}</h2>
        <dl className="reader__meta">
          <dt>{t.reader.from}</dt>
          <dd>
            <strong>{displayName(detail.from) || t.list.unknownSender}</strong>
            {detail.from?.name && <span className="reader__address"> &lt;{detail.from.address}&gt;</span>}
          </dd>
          <dt>{t.reader.to}</dt>
          <dd>{detail.to.map((entry) => displayName(entry)).join(', ')}</dd>
          {detail.cc.length > 0 && (
            <>
              <dt>{t.reader.cc}</dt>
              <dd>{detail.cc.map((entry) => displayName(entry)).join(', ')}</dd>
            </>
          )}
          <dt>{t.reader.date}</dt>
          <dd>{formatMailDate(detail.date)}</dd>
        </dl>
        {inTrash && <p className="reader__note">{t.reader.inTrash}</p>}
      </header>

      {files.length > 0 && (
        <section className="attachments" aria-label={t.reader.attachments}>
          <h3>{t.reader.attachments}</h3>
          <ul>
            {files.map((attachment) => (
              <AttachmentRow key={attachment.index} mail={detail} attachment={attachment} />
            ))}
          </ul>
        </section>
      )}

      {can('april', mode) && <AprilBox />}
      <MailBody mail={detail} />
    </section>
  )
}
