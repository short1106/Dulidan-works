import { ADVANCED_MODES, ALL_MODES, isAvailableIn, type Mode, type ModeScoped } from '@dulidan/core'

/**
 * Every function of Cortex and the modes it is visible in.
 * Basic mode: colorful note cards, "Neue Notiz", search, checklists,
 * pictures and the trash. No folders, no tags, no links between notes.
 */
export const FEATURES = {
  newNote: { modes: ALL_MODES },
  search: { modes: ALL_MODES },
  checklist: { modes: ALL_MODES },
  image: { modes: ALL_MODES },
  trash: { modes: ALL_MODES },
  pin: { modes: ALL_MODES },
  color: { modes: ALL_MODES },
  basicFormatting: { modes: ALL_MODES },

  listLayout: { modes: ADVANCED_MODES },
  folders: { modes: ADVANCED_MODES },
  tags: { modes: ADVANCED_MODES },
  links: { modes: ADVANCED_MODES },
  backlinks: { modes: ADVANCED_MODES },
  headings: { modes: ADVANCED_MODES },
  quoteAndCode: { modes: ADVANCED_MODES },
  tables: { modes: ADVANCED_MODES },
  attachments: { modes: ADVANCED_MODES },
  exportPdf: { modes: ADVANCED_MODES },
  exportMarkdown: { modes: ADVANCED_MODES },
  import: { modes: ADVANCED_MODES },
  quickNote: { modes: ADVANCED_MODES },

  april: { modes: ['pro'] as const }
} satisfies Record<string, ModeScoped>

export type FeatureId = keyof typeof FEATURES

export function can(feature: FeatureId, mode: Mode): boolean {
  return isAvailableIn(FEATURES[feature], mode)
}
