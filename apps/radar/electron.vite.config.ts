import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// One config for the three parts of an Electron app:
// main (Node side), preload (the narrow bridge) and renderer (the window).
// Everything is bundled into out/, so the installed app needs no node_modules, except electron-updater (kept outside, see packages/core/src/electron/updater.ts).
export default defineConfig({
  main: {
    build: { externalizeDeps: false, rollupOptions: { external: ['electron-updater'] } }
  },
  preload: {
    build: { externalizeDeps: false }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()]
  }
})
