/**
 * Exports an SVG logo as app icons: icon.png (1024 px), icon.ico (Windows)
 * and icon.icns (macOS). Uses Electron's own Chromium to render the SVG,
 * so no extra image library is needed.
 *
 * Usage (from the repository root):
 *   npx electron packages/design-system/scripts/export-icons.cjs <logo.svg> <output folder>
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
// macOS icon types that hold PNG data, by pixel size
const ICNS_TYPES = { 16: 'icp4', 32: 'icp5', 64: 'icp6', 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10' }

async function renderSizes(svg, sizes) {
  const window = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await window.loadURL('data:text/html,<canvas></canvas>')
  const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  const result = {}
  for (const size of sizes) {
    const dataUrl = await window.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => {
          const canvas = document.querySelector('canvas')
          canvas.width = ${size}
          canvas.height = ${size}
          const context = canvas.getContext('2d')
          context.clearRect(0, 0, ${size}, ${size})
          context.drawImage(image, 0, 0, ${size}, ${size})
          resolve(canvas.toDataURL('image/png'))
        }
        image.onerror = reject
        image.src = ${JSON.stringify(svgUrl)}
      })`)
    result[size] = Buffer.from(dataUrl.split(',')[1], 'base64')
  }
  window.destroy()
  return result
}

/** Windows .ico with PNG images inside (supported since Windows Vista). */
function buildIco(pngs) {
  const sizes = Object.keys(pngs).map(Number)
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16
    header.writeUInt8(size >= 256 ? 0 : size, entry) // 0 means 256
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt16LE(1, entry + 4) // color planes
    header.writeUInt16LE(32, entry + 6) // bits per pixel
    header.writeUInt32LE(pngs[size].length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += pngs[size].length
  })
  return Buffer.concat([header, ...sizes.map((size) => pngs[size])])
}

/** macOS .icns with PNG images inside. */
function buildIcns(pngs) {
  const chunks = Object.entries(ICNS_TYPES).map(([size, type]) => {
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(pngs[size].length + 8, 4)
    return Buffer.concat([head, pngs[size]])
  })
  const body = Buffer.concat(chunks)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const [svgPath, outDir] = process.argv.slice(-2)
  if (!svgPath?.endsWith('.svg') || !outDir) {
    console.error('Usage: electron export-icons.cjs <logo.svg> <output folder>')
    app.exit(1)
    return
  }
  const svg = fs.readFileSync(svgPath, 'utf8')
  const sizes = [...new Set([...ICO_SIZES, ...Object.keys(ICNS_TYPES).map(Number)])]
  const pngs = await renderSizes(svg, sizes)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'icon.png'), pngs[1024])
  fs.writeFileSync(path.join(outDir, 'icon.ico'), buildIco(Object.fromEntries(ICO_SIZES.map((s) => [s, pngs[s]]))))
  fs.writeFileSync(path.join(outDir, 'icon.icns'), buildIcns(pngs))
  console.log(`Icons written to ${outDir}`)
  app.exit(0)
})
