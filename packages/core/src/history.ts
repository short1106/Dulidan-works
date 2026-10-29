/**
 * Undo and redo for any app.
 *
 * Every step knows how to undo and redo itself and how many bytes it keeps
 * in memory. The history keeps at least `minSteps` steps and drops the
 * oldest ones only when there are more than `maxSteps` or the memory budget
 * is used up. Apps store only what changed (e.g. a small rectangle of
 * pixels), not whole copies, to save memory.
 */
export interface HistoryStep {
  /** Short name, e.g. "Pinsel" (for menus like "Rückgängig: Pinsel"). */
  label: string
  /** Memory held by this step, in bytes. */
  bytes: number
  undo(): void
  redo(): void
}

export interface HistoryOptions {
  /** Steps that are always kept, even above the memory budget. */
  minSteps?: number
  maxSteps?: number
  maxBytes?: number
}

export class History {
  private done: HistoryStep[] = []
  private undone: HistoryStep[] = []
  private readonly minSteps: number
  private readonly maxSteps: number
  private readonly maxBytes: number

  constructor({ minSteps = 50, maxSteps = 100, maxBytes = 512 * 1024 * 1024 }: HistoryOptions = {}) {
    this.minSteps = minSteps
    this.maxSteps = Math.max(maxSteps, minSteps)
    this.maxBytes = maxBytes
  }

  /** Records a step that was just done. Clears the redo list. */
  push(step: HistoryStep): void {
    this.done.push(step)
    this.undone = []
    this.trim()
  }

  undo(): HistoryStep | null {
    const step = this.done.pop()
    if (!step) return null
    step.undo()
    this.undone.push(step)
    return step
  }

  redo(): HistoryStep | null {
    const step = this.undone.pop()
    if (!step) return null
    step.redo()
    this.done.push(step)
    return step
  }

  canUndo(): boolean {
    return this.done.length > 0
  }

  canRedo(): boolean {
    return this.undone.length > 0
  }

  clear(): void {
    this.done = []
    this.undone = []
  }

  get undoCount(): number {
    return this.done.length
  }

  get redoCount(): number {
    return this.undone.length
  }

  get bytes(): number {
    return [...this.done, ...this.undone].reduce((sum, step) => sum + step.bytes, 0)
  }

  private trim(): void {
    while (this.done.length > this.maxSteps) this.done.shift()
    while (this.done.length > this.minSteps && this.bytes > this.maxBytes) this.done.shift()
  }
}
