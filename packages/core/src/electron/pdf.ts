import { BrowserWindow, type WebContents } from 'electron'

/** 2.5 cm page margins, given in inches as Electron expects. */
const MARGIN_INCH = 2.5 / 2.54

/**
 * Turns what a window shows into an A4 PDF. The window's print stylesheet
 * decides what is visible (usually only the document). Chromium splits it
 * into pages; a small page number sits at the bottom. No extra library.
 */
export async function renderPdf(contents: WebContents): Promise<Buffer> {
  // The page margins show the window's background and the color scheme's
  // page color; dark apps would get dark margins. For the PDF both are white.
  const window = BrowserWindow.fromWebContents(contents)
  const previous = window?.getBackgroundColor()
  window?.setBackgroundColor('#ffffff')
  const css = await contents.insertCSS('@media print { :root { color-scheme: light !important; } }')
  try {
    return await contents.printToPDF({
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
  } finally {
    await contents.removeInsertedCSS(css)
    if (window && previous) window.setBackgroundColor(previous)
  }
}
