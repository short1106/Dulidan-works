import { useSyncExternalStore } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'

/**
 * Asks the user a question in a dialog and waits for the answer:
 *
 *   const answer = await ask({ title, text, cancelValue: 'cancel', choices: [...] })
 *
 * Render <QuestionDialog /> once in the app.
 */
export interface Choice<T extends string> {
  value: T
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

interface Question {
  title: string
  text: string
  choices: Array<Choice<string>>
  cancelValue: string
  resolve: (value: string) => void
}

let current: Question | null = null
const listeners = new Set<() => void>()

function set(next: Question | null): void {
  current = next
  listeners.forEach((listener) => listener())
}

export function ask<T extends string>(question: { title: string; text: string; choices: Array<Choice<T>>; cancelValue: T }): Promise<T> {
  return new Promise((resolve) => {
    set({
      ...question,
      resolve: (value) => {
        set(null)
        resolve(value as T)
      }
    })
  })
}

export function QuestionDialog(): React.JSX.Element | null {
  const question = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
  if (!question) return null
  return (
    <Dialog
      open
      title={question.title}
      onClose={() => question.resolve(question.cancelValue)}
      actions={question.choices.map((choice, index) => (
        <Button
          key={choice.value}
          variant={choice.variant ?? 'secondary'}
          autoFocus={index === question.choices.length - 1}
          onClick={() => question.resolve(choice.value)}
        >
          {choice.label}
        </Button>
      ))}
    >
      <p>{question.text}</p>
    </Dialog>
  )
}
