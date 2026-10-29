import type { Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import { t } from '../i18n'
import { SearchReplace } from './searchReplace'

/**
 * All editor features. The list is the same in every mode, so a document
 * looks identical everywhere; modes only change the buttons.
 */
export function createExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto']
      }
    }),
    TextStyleKit.configure({ backgroundColor: false, lineHeight: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({
      allowBase64: true,
      resize: {
        enabled: true,
        alwaysPreserveAspectRatio: true,
        minWidth: 40,
        minHeight: 40,
        directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
      }
    }),
    TableKit.configure({ table: { resizable: true } }),
    CharacterCount,
    Placeholder.configure({ placeholder: t.editor.placeholder }),
    SearchReplace
  ]
}

/** Font choices. Only fonts that ship with Glyph or generic system families. */
export const FONT_FAMILIES = [
  { label: t.fonts.default, value: null },
  { label: t.fonts.rajdhani, value: 'Rajdhani' },
  { label: t.fonts.serif, value: 'serif' },
  { label: t.fonts.mono, value: 'monospace' }
] as const

/** Font sizes in points, as in other word processors. Default text is 12 pt. */
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64] as const
export const DEFAULT_FONT_SIZE = 12

/** Text colors that stay readable on white paper. */
export const TEXT_COLORS = ['#1a1222', '#6b6475', '#c62828', '#d76a03', '#2e7d32', '#1f5fbf', '#8122b5', '#c020b8'] as const
