import { describe, expect, it } from 'vitest'
import { ADVANCED_MODES, ALL_MODES, filterByMode, isAvailableIn, isMode } from '../src/mode'
import { createStore } from '../src/store'

describe('modes', () => {
  const features = [
    { id: 'bold', modes: ALL_MODES },
    { id: 'table', modes: ADVANCED_MODES },
    { id: 'april', modes: ['pro'] as const }
  ]

  it('shows only the features of the current mode', () => {
    expect(filterByMode(features, 'basic').map((f) => f.id)).toEqual(['bold'])
    expect(filterByMode(features, 'expert').map((f) => f.id)).toEqual(['bold', 'table'])
    expect(filterByMode(features, 'pro').map((f) => f.id)).toEqual(['bold', 'table', 'april'])
  })

  it('checks single features', () => {
    expect(isAvailableIn(features[1]!, 'basic')).toBe(false)
    expect(isAvailableIn(features[1]!, 'pro')).toBe(true)
  })

  it('recognizes valid mode values', () => {
    expect(isMode('basic')).toBe(true)
    expect(isMode('Basic')).toBe(false)
    expect(isMode(undefined)).toBe(false)
  })
})

describe('store', () => {
  it('notifies subscribers on change only', () => {
    const store = createStore({ mode: 'basic' })
    let calls = 0
    const unsubscribe = store.subscribe(() => calls++)
    store.set((s) => ({ ...s, mode: 'expert' }))
    expect(store.get().mode).toBe('expert')
    store.set(store.get())
    expect(calls).toBe(1)
    unsubscribe()
    store.set({ mode: 'pro' })
    expect(calls).toBe(1)
  })
})
