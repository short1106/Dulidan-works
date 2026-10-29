import { Button, Dialog } from '@dulidan/design-system'
import { useQuestion } from '../state/ask'

/** Shows the question asked with ask(), e.g. "Änderungen speichern?". */
export function QuestionDialog(): React.JSX.Element | null {
  const question = useQuestion()
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
