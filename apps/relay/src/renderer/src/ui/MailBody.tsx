import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { ask, Button, notify } from '@dulidan/design-system'
import type { MessageDetail } from '../../../shared/ipc'
import { t } from '../i18n'
import { mailDocument, sanitizeMailHtml, textToHtml } from '../mail/sanitize'
import { openCompose } from '../state/compose'

/** Host name of a web address, e.g. "www.bank.de". */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * Asks before a link opens and shows where it really leads. Warns if the
 * visible text pretends to be another address (a typical phishing trick).
 */
async function confirmLink(href: string, visibleText: string): Promise<void> {
  if (/^mailto:/i.test(href)) {
    const address = decodeURIComponent(href.replace(/^mailto:/i, '').split('?')[0] ?? '')
    await openCompose('new', undefined, { to: address })
    return
  }
  if (!/^https?:\/\//i.test(href)) return
  const host = hostOf(href)
  const shown = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.exec(visibleText.trim())?.[0]
  const shownHost = shown ? hostOf(shown.startsWith('http') ? shown : `https://${shown}`) : null
  const mismatch = shownHost && shownHost.replace(/^www\./, '') !== host.replace(/^www\./, '') ? `${t.reader.linkMismatch(shown!, host)}\n\n` : ''
  const answer = await ask({
    title: t.reader.linkTitle,
    text: mismatch + t.reader.linkText(host, href),
    cancelValue: 'no',
    choices: [
      { value: 'no', label: t.dialogs.cancel, variant: 'ghost' },
      { value: 'yes', label: t.reader.openLink, variant: mismatch ? 'secondary' : 'primary' }
    ]
  })
  if (answer === 'yes') await window.relay.mail.openLink(href)
}

/**
 * The mail text in a closed-off frame: sandbox without scripts, no network
 * (the window's security policy blocks it), links only after a question.
 */
export function MailBody({ mail }: { mail: MessageDetail }): React.JSX.Element {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [images, setImages] = useState<Record<string, string> | null>(null)
  const [loadingImages, setLoadingImages] = useState(false)
  const [height, setHeight] = useState(200)

  useEffect(() => setImages(null), [mail.id])

  const safe = useMemo(() => {
    if (mail.html) return sanitizeMailHtml(mail.html, images)
    return { html: textToHtml(mail.text), remoteImages: [] }
  }, [mail.html, mail.text, images])

  const loadImages = async (): Promise<void> => {
    setLoadingImages(true)
    const loaded = await window.relay.mail.loadRemoteImages(safe.remoteImages)
    setLoadingImages(false)
    setImages(loaded)
    const missing = safe.remoteImages.length - Object.keys(loaded).length
    if (missing > 0) notify(t.reader.imagesMissing(missing), 'info')
  }

  // Links and size: the frame has no scripts, so the window watches it.
  const onLoad = (): void => {
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    doc.addEventListener('click', (event) => {
      const link = (event.target as Element | null)?.closest?.('a[href]')
      if (!link) return
      event.preventDefault()
      void confirmLink(link.getAttribute('href') ?? '', link.textContent ?? '')
    })
    const resize = (): void => setHeight(Math.max(120, doc.documentElement.scrollHeight))
    resize()
    new ResizeObserver(resize).observe(doc.body)
    doc.querySelectorAll('img').forEach((img) => img.addEventListener('load', resize))
  }

  return (
    <div className="mail-body">
      {safe.remoteImages.length > 0 && images === null && (
        <div className="mail-body__blocked" role="status">
          <ImageOff aria-hidden="true" />
          <span>{t.reader.blockedImages(safe.remoteImages.length)}</span>
          <Button disabled={loadingImages} onClick={() => void loadImages()}>
            {loadingImages ? t.reader.loadingImages : t.reader.loadImages}
          </Button>
        </div>
      )}
      <iframe
        ref={frameRef}
        className="mail-body__frame"
        title={mail.subject || t.list.noSubject}
        // allow-same-origin without allow-scripts: no code runs inside,
        // the window may only read the frame to handle links and size.
        sandbox="allow-same-origin"
        srcDoc={mailDocument(safe.html)}
        style={{ height }}
        onLoad={onLoad}
      />
    </div>
  )
}
