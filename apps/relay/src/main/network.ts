import { session, type Session } from 'electron'

/**
 * The window itself may not reach the internet at all. Mail servers are
 * contacted only by the main process (IMAP/SMTP sockets), and images in
 * mails only when the user asks for them, through a separate session.
 */
export function lockDownWindowNetwork(devServerUrl: string | undefined): void {
  const allowedOrigin = devServerUrl ? new URL(devServerUrl).origin : null
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => {
    const allowed = allowedOrigin !== null && details.url.startsWith(allowedOrigin)
    callback({ cancel: !allowed })
  })
  // No camera, microphone, location, ... for the window.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
}

const MAX_IMAGES = 40
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

let imageSession: Session | null = null

/**
 * "Bilder laden": fetches the images of one mail and returns them as data
 * URLs. Runs in its own session without cookies, so senders cannot
 * recognize the user by cookies.
 */
export async function fetchRemoteImages(urls: string[]): Promise<Record<string, string>> {
  imageSession ??= session.fromPartition('relay-remote-images', { cache: false })
  const result: Record<string, string> = {}
  const unique = [...new Set(urls.filter((url) => /^https?:\/\//i.test(url)))].slice(0, MAX_IMAGES)
  await Promise.all(
    unique.map(async (url) => {
      try {
        const response = await imageSession!.fetch(url, { signal: AbortSignal.timeout(10_000), credentials: 'omit', redirect: 'follow' })
        const type = response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
        if (!response.ok || !type.startsWith('image/') || type === 'image/svg+xml') return
        const bytes = Buffer.from(await response.arrayBuffer())
        if (bytes.length > MAX_IMAGE_BYTES) return
        result[url] = `data:${type};base64,${bytes.toString('base64')}`
      } catch {
        // Image not available: it simply stays hidden.
      }
    })
  )
  return result
}
