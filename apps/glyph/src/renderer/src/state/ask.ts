import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'

/**
 * Asks the user a question in a dialog and waits for the answer:
 *
 *   const answer = await ask({ title, text, choices: [...] })
 */
export interface Choice<T extends string> {
  value: T
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

export interface Question {
  title: string
  text: string
  choices: Array<Choice<string>>
  /** Answer when the dialog is closed with Escape. */
  cancelValue: string
  resolve: (value: string) => void
}

const questionStore = createStore<Question | null>(null)

export function ask<T extends string>(question: {
  title: string
  text: string
  choices: Array<Choice<T>>
  cancelValue: T
}): Promise<T> {
  return new Promise((resolve) => {
    questionStore.set({
      ...question,
      resolve: (value) => {
        questionStore.set(null)
        resolve(value as T)
      }
    })
  })
}

export function useQuestion(): Question | null {
  return useSyncExternalStore(questionStore.subscribe, questionStore.get)
}
