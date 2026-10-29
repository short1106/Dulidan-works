import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { addRecentFile, normalizeSettings, type Settings } from '@dulidan/core'
import { atomicWriteFile } from '@dulidan/core/node'

/**
 * Loads and stores the user settings as settings.json in the app data
 * folder (on Windows: %APPDATA%\Dulidan Glyph).
 */
export class SettingsService {
  private settings: Settings = normalizeSettings(undefined)
  private readonly listeners = new Set<(settings: Settings) => void>()
  private readonly file = join(app.getPath('userData'), 'settings.json')

  async load(): Promise<Settings> {
    try {
      this.settings = normalizeSettings(JSON.parse(await readFile(this.file, 'utf8')))
    } catch {
      // No file yet (first start) or unreadable: start with defaults.
      this.settings = normalizeSettings(undefined)
    }
    return this.settings
  }

  get(): Settings {
    return this.settings
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    this.settings = normalizeSettings({ ...this.settings, ...patch })
    await atomicWriteFile(this.file, JSON.stringify(this.settings, null, 2))
    this.listeners.forEach((listener) => listener(this.settings))
    return this.settings
  }

  async addRecentFile(filePath: string): Promise<void> {
    await this.update({ recentFiles: addRecentFile(this.settings.recentFiles, filePath) })
  }

  async removeRecentFile(filePath: string): Promise<void> {
    await this.update({ recentFiles: this.settings.recentFiles.filter((item) => item !== filePath) })
  }

  onChange(listener: (settings: Settings) => void): void {
    this.listeners.add(listener)
  }
}
