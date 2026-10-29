import { basename, extname, resolve } from 'node:path'
import { app, dialog, type BrowserWindow } from 'electron'
import { atomicWriteFile } from '@dulidan/core/node'
import type { ExportResult } from '../shared/ipc'
import { describeLocation } from './documents'

/** 2.5 cm page margins, given in inches as Electron expects. */
const MARGIN_INCH = 2.5 / 2.54

/**
 * PDF export and printing use the window itself: its print stylesheet hides
 * everything except the document, and Chromium splits it into A4 pages.
 * No extra library needed.
 */
export async function exportPdf(window: BrowserWindow, suggestedName: string): Promise<ExportResult> {
  const name = suggestedName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'Dokument'
  const result = await dialog.showSaveDialog(window, {
    title: 'Als PDF speichern',
    defaultPath: resolve(app.getPath('documents'), `${name}.pdf`),
    filters: [{ name: 'PDF-Dokument', extensions: ['pdf'] }],
    properties: ['showOverwriteConfirmation', 'createDirectory']
  })
  if (result.canceled || !result.filePath) return { ok: false, canceled: true }
  let filePath = result.filePath
  if (extname(filePath).toLowerCase() !== '.pdf') filePath += '.pdf'

  try {
    const pdf = await window.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: MARGIN_INCH, bottom: MARGIN_INCH, left: MARGIN_INCH, right: MARGIN_INCH },
      generateDocumentOutline: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      // Small page number at the bottom center, e.g. "2 / 5".
      footerTemplate:
        '<div style="width:100%;text-align:center;font-family:sans-serif;font-size:8pt;color:#777">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    })
    await atomicWriteFile(filePath, pdf)
    return { ok: true, location: { ...describeLocation(filePath), fileName: basename(filePath) } }
  } catch (error) {
    console.error('PDF export failed', error)
    return { ok: false }
  }
}

/** Opens the system print dialog for the current document. */
export function printDocument(window: BrowserWindow): Promise<ExportResult> {
  return new Promise((resolvePrint) => {
    window.webContents.print(
      {
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'custom', top: 71, bottom: 71, left: 71, right: 71 }
      },
      (success, reason) => {
        // Closing the dialog without printing is not an error.
        resolvePrint({ ok: success, canceled: !success && reason === 'Print job canceled' })
      }
    )
  })
}
