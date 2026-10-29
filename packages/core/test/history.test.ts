import { describe, expect, it } from 'vitest'
import { History, type HistoryStep } from '../src/history'

/** A step that adds `amount` to a counter. */
function counterStep(state: { value: number }, amount: number, bytes = 10): HistoryStep {
  state.value += amount
  return {
    label: `+${amount}`,
    bytes,
    undo: () => (state.value -= amount),
    redo: () => (state.value += amount)
  }
}

describe('History', () => {
  it('undoes and redoes in the right order', () => {
    const state = { value: 0 }
    const history = new History()
    history.push(counterStep(state, 1))
    history.push(counterStep(state, 10))
    expect(state.value).toBe(11)
    history.undo()
    expect(state.value).toBe(1)
    history.undo()
    expect(state.value).toBe(0)
    expect(history.undo()).toBeNull()
    history.redo()
    history.redo()
    expect(state.value).toBe(11)
    expect(history.redo()).toBeNull()
  })

  it('clears redo after a new step', () => {
    const state = { value: 0 }
    const history = new History()
    history.push(counterStep(state, 1))
    history.undo()
    history.push(counterStep(state, 5))
    expect(history.canRedo()).toBe(false)
    expect(state.value).toBe(5)
  })

  it('keeps at least 50 steps', () => {
    const state = { value: 0 }
    const history = new History({ minSteps: 50, maxSteps: 60 })
    for (let i = 0; i < 80; i++) history.push(counterStep(state, 1))
    expect(history.undoCount).toBe(60)
    for (let i = 0; i < 60; i++) history.undo()
    expect(state.value).toBe(20)
  })

  it('drops old steps above the memory budget, but never below the minimum', () => {
    const state = { value: 0 }
    const history = new History({ minSteps: 50, maxSteps: 100, maxBytes: 1000 })
    for (let i = 0; i < 100; i++) history.push(counterStep(state, 1, 100))
    expect(history.undoCount).toBe(50)
    const small = new History({ minSteps: 50, maxSteps: 100, maxBytes: 1000 })
    for (let i = 0; i < 100; i++) small.push(counterStep(state, 1, 5))
    expect(small.undoCount).toBe(100)
  })
})
