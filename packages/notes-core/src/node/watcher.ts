import { watch, type FSWatcher } from 'node:fs'

/**
 * Watches the notes folder for changes made outside Cortex (another
 * editor, a sync program, the file explorer). Many events in a short time
 * are collected into one call.
 */
export function watchFolder(root: string, onChange: () => void, delayMs = 400): () => void {
  let timer: NodeJS.Timeout | null = null
  let watcher: FSWatcher | null = null
  const trigger = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      onChange()
    }, delayMs)
  }
  try {
    watcher = watch(root, { recursive: true }, (_event, name) => {
      const path = String(name ?? '').replace(/\\/g, '/')
      // Our own temporary files (".name.md.xxxx.tmp") are not changes.
      if (/(^|\/)\.[^/]*\.tmp$/.test(path)) return
      trigger()
    })
    watcher.on('error', () => undefined)
  } catch {
    // Watching is a convenience: without it, changes show up on the next start.
  }
  return () => {
    if (timer) clearTimeout(timer)
    watcher?.close()
  }
}
