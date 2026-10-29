import DOMPurify from 'dompurify'

/**
 * Makes sender HTML safe to show. Scripts, forms, frames, plug-ins and
 * event handlers are removed. Images from the internet are held back
 * (they can reveal that and when a mail was read) until the user clicks
 * "Bilder laden" for this one mail.
 */

export interface SafeHtml {
  html: string
  /** Addresses of images that were held back. */
  remoteImages: string[]
}

export function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Plain text mail as HTML: kept line breaks, web addresses as links. */
export function textToHtml(text: string): string {
  const escaped = escapeText(text)
  const linked = escaped.replace(/\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g, (url) => `<a href="${url}">${url}</a>`)
  return `<div style="white-space: pre-wrap">${linked}</div>`
}

const FORBID_TAGS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button', 'textarea', 'select', 'option', 'link', 'meta', 'base', 'audio', 'video', 'source', 'track', 'svg', 'math', 'portal', 'template']
const FORBID_ATTR = ['srcset', 'ping', 'action', 'formaction', 'background', 'poster', 'xlink:href', 'lowsrc', 'dynsrc']

/** Removes url(...) with web addresses from inline CSS (tracking pixels in backgrounds). */
function stripRemoteCss(style: string): string {
  return style.replace(/url\(\s*(['"]?)\s*(https?:)?\/\/[^)]*\)/gi, 'none')
}

export function sanitizeMailHtml(html: string, remoteImages: Record<string, string> | null): SafeHtml {
  const held: string[] = []
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.hasAttribute('style')) node.setAttribute('style', stripRemoteCss(node.getAttribute('style') ?? ''))
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') ?? ''
      if (/^(https?:)?\/\//i.test(src)) {
        const url = src.startsWith('//') ? `https:${src}` : src
        const loaded = remoteImages?.[url]
        if (loaded) {
          node.setAttribute('src', loaded)
        } else {
          held.push(url)
          node.removeAttribute('src')
          node.setAttribute('data-blocked', '')
        }
      } else if (!/^data:image\//i.test(src)) {
        node.removeAttribute('src')
      }
    }
    if (node.tagName === 'A') {
      node.removeAttribute('target')
      node.setAttribute('rel', 'noreferrer noopener')
    }
  })
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    // CSS in <style> may load images from the internet: remove such rules.
    if (data.tagName === 'style' && node.textContent) node.textContent = stripRemoteCss(node.textContent).replace(/@import[^;]+;/gi, '')
  })
  try {
    const clean = DOMPurify.sanitize(html, {
      FORBID_TAGS,
      FORBID_ATTR,
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['data-blocked'],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data|cid):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
    })
    return { html: clean, remoteImages: [...new Set(held)] }
  } finally {
    DOMPurify.removeAllHooks()
  }
}

/** The full document for the closed-off view (no scripts, no network). */
export function mailDocument(bodyHtml: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
    html { color-scheme: light; }
    body { margin: 0; padding: 18px 22px; font: 15px/1.55 Inter, system-ui, sans-serif; color: #1a1222; background: #ffffff; overflow-wrap: anywhere; }
    img { max-width: 100%; height: auto; }
    img[data-blocked] { display: inline-block; min-width: 24px; min-height: 16px; background: repeating-linear-gradient(45deg, #eee, #eee 4px, #ddd 4px, #ddd 8px); }
    a { color: #1f5fbf; }
    blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid #c9bfd6; color: #4a4155; }
    pre { white-space: pre-wrap; }
  </style></head><body>${bodyHtml}</body></html>`
}
