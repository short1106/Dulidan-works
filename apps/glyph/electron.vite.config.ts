import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// One config for the three parts of an Electron app:
// main (Node side), preload (the narrow bridge) and renderer (the window).
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()]
  }
})
