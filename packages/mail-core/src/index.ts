/**
 * Dulidan mail-core: mail and calendar logic without user interface.
 * Runs in the Electron main process (Node). Used by Relay and later Radar.
 */
export * from './types'
export * from './accounts'
export * from './errors'
export { MailCache, buildSearchQuery, makeSnippet } from './cache'
export { ImapSession, verifyImap, type ServerLogin } from './imap'
export { parseMail, extractAttachment, extractInlineImages, toAddresses, type AttachmentContent } from './parse'
export * from './smtp'
export * from './templates'
export * from './sentLog'
export * from './drafts'
export * from './service'
export * from './calendar/time'
export * from './calendar/events'
export * from './calendar/store'
export * from './calendar/ics'
export { openDatabase, type Database } from './sqlite'
