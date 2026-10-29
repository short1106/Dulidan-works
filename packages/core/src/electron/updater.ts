import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Automatic updates for the installed Windows version.
 *
 * On every start the app asks GitHub (the "neueste Version" release) whether a
 * newer version exists. If so, it downloads it in the background. The new
 * version is installed when the app is closed, so the next start already runs it.
 *
 * Each app has its own feed file on the release (glyph.yml, pixel.yml, ...), so
 * `channel` must be the app name, the same as in its electron-builder.yml.
 *
 * Silent by design: no dialog, and no error is shown if the computer is offline.
 * The portable EXE cannot update itself, so it is skipped there.
 */
export function startAutoUpdate(channel: string): void {
  // Only the packaged app updates. In development (npm run dev) there is nothing to update.
  if (!app.isPackaged) return
  // The portable EXE unpacks itself to a temporary folder and has no installer to run.
  if (process.env['PORTABLE_EXECUTABLE_DIR']) return

  autoUpdater.channel = channel
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = console

  autoUpdater.on('error', (error) => {
    console.warn('Update check failed (no internet or no release yet)', error)
  })

  void autoUpdater.checkForUpdates().catch((error) => {
    console.warn('Update check failed', error)
  })
}
