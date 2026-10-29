import type { Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { t } from '../i18n'
import { WikiLinks, type WikiLinkOptions } from './wikiLinks'

/**
 * The Cortex editor: the same TipTap core as Glyph, reduced to what
 * Markdown can store (headings, bold, italic, lists, checklists, links,
 * pictures, simple tables, quotes, code). No underline, colors, fonts or
 * alignment, because a Markdown file cannot keep them.
 */
export function createExtensions(links: WikiLinkOptions | null): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      underline: false,
      strike: false,
      horizontalRule: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => /^(https?:|mailto:|cortex:\/\/attachments\/)/i.test(url)
      }
    }),
    Image.configure({
      allowBase64: false,
      resize: {
        enabled: true,
        alwaysPreserveAspectRatio: true,
        minWidth: 40,
        minHeight: 40,
        directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
      }
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // Column widths cannot be stored in Markdown, so tables are not resizable.
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder: t.note.placeholder }),
    ...(links ? [WikiLinks.configure(links)] : [])
  ]
}
