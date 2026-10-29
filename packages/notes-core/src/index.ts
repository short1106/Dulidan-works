/**
 * Dulidan notes core: the note logic of Cortex, without UI and without file
 * access (file access is in '@dulidan/notes-core/node').
 */
export * from './types'
export * from './frontMatter'
export * from './names'
export * from './links'
export * from './search'
export * from './trash'
export * from './attachments'
export { toMarkdown, escapeText, plainTextToMarkdown, type JsonNode, type JsonMark, type SerializeOptions } from './markdown/serialize'
export { markdownToHtml, markdownToPlain, type ParseOptions, type PlainText } from './markdown/parse'
