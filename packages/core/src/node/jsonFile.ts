import { readFile } from 'node:fs/promises'
import { atomicWriteFile } from './atomicWrite'

/**
 * A small JSON file with a fixed shape, e.g. settings or preferences.
 * `normalize` turns whatever is on disk into a valid value, so a damaged
 * or missing file never blocks the app.
 */
export class JsonFile<T> {
  private value: T

  constructor(
    private readonly path: string,
    private readonly normalize: (raw: unknown) => T
  ) {
    this.value = normalize(undefined)
  }

  async load(): Promise<T> {
    try {
      this.value = this.normalize(JSON.parse(await readFile(this.path, 'utf8')))
    } catch {
      this.value = this.normalize(undefined)
    }
    return this.value
  }

  get(): T {
    return this.value
  }

  async update(patch: Partial<T>): Promise<T> {
    this.value = this.normalize({ ...this.value, ...patch })
    await atomicWriteFile(this.path, JSON.stringify(this.value, null, 2))
    return this.value
  }
}
