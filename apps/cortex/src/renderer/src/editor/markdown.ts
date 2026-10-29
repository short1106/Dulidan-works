import { attachmentUrlFromFile, attachmentUrlToFile, markdownToHtml, toMarkdown, type JsonNode } from '@dulidan/notes-core'

/**
 * The bridge between the Markdown file and the editor. Pictures and
 * attached files are written relative to the note in the file
 * ("attachments/x.png") and loaded as "cortex://attachments/x.png" in the
 * window.
 */
export function noteToEditorHtml(body: string, notePath: string): string {
  const toWindow = (src: string): string => attachmentUrlFromFile(src, notePath)
  return markdownToHtml(body, { imageSrc: toWindow, linkHref: toWindow })
}

export function editorToMarkdown(doc: JsonNode, notePath: string): string {
  const toFile = (src: string): string => attachmentUrlToFile(src, notePath)
  return toMarkdown(doc, { imageSrc: toFile, linkHref: toFile })
}
