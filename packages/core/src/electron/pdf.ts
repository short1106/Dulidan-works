import { BrowserWindow, type WebContents } from 'electron'

/** 2.5 cm page margins, given in inches as Electron expects. */
const MARGIN_INCH = 2.5 / 2.54

export interface PdfOptions {
  /** Pages lying on their side, e.g. for slides. */
  landscape?: boolean
  /** No page margins; the page layout comes from the window's print stylesheet. */
  noMargins?: boolean
  /** Small page number at the bottom (default: yes). */
  pageNumbers?: boolean
}

/**
 * Turns what a window shows into an A4 PDF. The window's print stylesheet
 * decides what is visible (usually only the document). Chromium splits it
 * into pages; a small page number sits at the bottom. No extra library.
 */
export async function renderPdf(contents: WebContents, options: PdfOptions = {}): Promise<Buffer> {
  const margin = options.noMargins ? 0 : MARGIN_INCH
  const pageNumbers = options.pageNumbers ?? true
  // The page margins show the window's background and the color scheme's
  // page color; dark apps would get dark margins. For the PDF both are white.
  // The text cursor of a focused editor would be printed too, so it is hidden.
  const window = BrowserWindow.fromWebContents(contents)
  const previous = window?.getBackgroundColor()
  window?.setBackgroundColor('#ffffff')
  const css = await contents.insertCSS('@media print { :root { color-scheme: light !important; } * { caret-color: transparent !important; } }')
  try {
    return await contents.printToPDF({
      pageSize: 'A4',
      landscape: options.landscape ?? false,
      printBackground: true,
      margins: { top: margin, bottom: margin, left: margin, right: margin },
      generateDocumentOutline: true,
      displayHeaderFooter: pageNumbers,
      headerTemplate: '<span></span>',
      // Small page number at the bottom center, e.g. "2 / 5".
      footerTemplate:
        '<div style="width:100%;text-align:center;font-family:sans-serif;font-size:8pt;color:#777">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    })
  } finally {
    await contents.removeInsertedCSS(css)
    if (window && previous) window.setBackgroundColor(previous)
  }
}
