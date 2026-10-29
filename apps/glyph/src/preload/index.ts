import { contextBridge } from 'electron'
import type { GlyphApi } from './api'

// The preload script is the only bridge between the window and the system.
// It stays deliberately small: every function is named for exactly one job.
// Open, save and export join here in step 6 and 7.
const api: GlyphApi = {
  platform: process.platform
}

contextBridge.exposeInMainWorld('glyph', api)
