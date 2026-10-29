import { randomBytes } from 'node:crypto'
import { open, rename, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

/**
 * Writes a file so that it is never half written.
 *
 * 1. Write everything into a temporary file next to the target.
 * 2. Flush it to the disk (fsync).
 * 3. Rename it over the target. A rename on the same drive is atomic:
 *    afterwards there is either the complete old or the complete new file.
 *
 * If anything fails, the old file stays untouched and the temp file is removed.
 */
export async function atomicWriteFile(path: string, data: Uint8Array | string): Promise<void> {
  const tempPath = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString('hex')}.tmp`)
  try {
    const handle = await open(tempPath, 'w')
    try {
      await handle.writeFile(data)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(tempPath, path)
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    throw error
  }
}
