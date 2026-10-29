import { ADVANCED_MODES, ALL_MODES, isAvailableIn, type Mode, type ModeScoped } from '@dulidan/core'

/**
 * Every function of Relay and the modes it is visible in.
 * Basic mode: inbox, reading, reply, new mail, attachments, trash and the
 * month calendar with "Termin anlegen". Everything else from expert on.
 */
export const FEATURES = {
  inbox: { modes: ALL_MODES },
  read: { modes: ALL_MODES },
  reply: { modes: ALL_MODES },
  newMail: { modes: ALL_MODES },
  attachments: { modes: ALL_MODES },
  trash: { modes: ALL_MODES },
  calendarMonth: { modes: ALL_MODES },
  createEvent: { modes: ALL_MODES },

  folders: { modes: ADVANCED_MODES },
  replyAll: { modes: ADVANCED_MODES },
  forward: { modes: ADVANCED_MODES },
  markUnread: { modes: ADVANCED_MODES },
  ccBcc: { modes: ADVANCED_MODES },
  drafts: { modes: ADVANCED_MODES },
  search: { modes: ADVANCED_MODES },
  calendarWeek: { modes: ADVANCED_MODES },
  recurrence: { modes: ADVANCED_MODES },
  importIcs: { modes: ADVANCED_MODES },
  serverSettings: { modes: ADVANCED_MODES },

  april: { modes: ['pro'] as const }
} satisfies Record<string, ModeScoped>

export type FeatureId = keyof typeof FEATURES

export function can(feature: FeatureId, mode: Mode): boolean {
  return isAvailableIn(FEATURES[feature], mode)
}
