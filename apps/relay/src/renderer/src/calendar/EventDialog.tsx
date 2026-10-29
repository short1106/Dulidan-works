import { useEffect, useState } from 'react'
import { ask, Button, Dialog, notify, TextField } from '@dulidan/design-system'
import type { CalendarEvent, CalendarEventInput } from '../../../shared/ipc'
import { can } from '../features'
import { t } from '../i18n'
import { errorText } from '../state/mail'
import { useMode } from '../state/settings'
import { dateOf, timeOf } from './dates'

type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'
type Ends = 'never' | 'until' | 'count'

export interface EventDialogState {
  /** Existing event to edit, or null for a new one. */
  event: CalendarEvent | null
  /** Day for a new event. */
  day: string
}

interface Props {
  state: EventDialogState | null
  onClose: () => void
  onSaved: () => void
}

export function EventDialog({ state, onClose, onSaved }: Props): React.JSX.Element | null {
  const mode = useMode()
  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('11:00')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [reminder, setReminder] = useState(15)
  const [repeat, setRepeat] = useState<Repeat>('none')
  const [interval, setInterval] = useState(1)
  const [ends, setEnds] = useState<Ends>('never')
  const [until, setUntil] = useState('')
  const [count, setCount] = useState(10)

  useEffect(() => {
    if (!state) return
    const event = state.event
    setTitle(event?.title ?? '')
    setAllDay(event?.allDay ?? false)
    setDate(event ? dateOf(event.start) : state.day)
    setEndDate(event ? dateOf(event.end) : state.day)
    setStart(event && !event.allDay ? timeOf(event.start) : '10:00')
    setEnd(event && !event.allDay ? timeOf(event.end) : '11:00')
    setLocation(event?.location ?? '')
    setNotes(event?.notes ?? '')
    setReminder(event ? (event.reminderMinutes ?? -1) : 15)
    setRepeat(event?.recurrence?.frequency ?? 'none')
    setInterval(event?.recurrence?.interval ?? 1)
    setEnds(event?.recurrence?.until ? 'until' : event?.recurrence?.count ? 'count' : 'never')
    setUntil(event?.recurrence?.until ?? '')
    setCount(event?.recurrence?.count ?? 10)
  }, [state])

  if (!state) return null
  const recurrenceAllowed = can('recurrence', mode)

  const build = (): CalendarEventInput => ({
    title: title.trim(),
    location: location.trim(),
    notes: notes.trim(),
    start: `${date}T${allDay ? '00:00' : start}`,
    end: `${allDay ? endDate || date : date}T${allDay ? '00:00' : end}`,
    allDay,
    timeZone: 'Europe/Berlin',
    reminderMinutes: reminder < 0 ? null : reminder,
    recurrence:
      recurrenceAllowed && repeat !== 'none'
        ? { frequency: repeat, interval: Math.max(1, interval), until: ends === 'until' ? until || null : null, count: ends === 'count' ? Math.max(1, count) : null }
        : (state.event?.recurrence ?? null),
    icsUid: state.event?.icsUid ?? null,
    relatedMessageId: state.event?.relatedMessageId ?? null
  })

  const save = async (): Promise<void> => {
    const input = build()
    const result = state.event ? await window.relay.calendar.update(state.event.id, input) : await window.relay.calendar.add(input)
    if (!result.ok) {
      notify(result.message?.startsWith('Invalid event') ? t.event.invalid : errorText(result.error), 'error')
      return
    }
    onSaved()
    onClose()
  }

  const remove = async (): Promise<void> => {
    if (!state.event) return
    const answer = await ask({
      title: t.event.removeTitle,
      text: t.event.removeText(state.event.title, !!state.event.recurrence),
      cancelValue: 'no',
      choices: [
        { value: 'no', label: t.dialogs.cancel, variant: 'ghost' },
        { value: 'yes', label: t.event.remove, variant: 'primary' }
      ]
    })
    if (answer !== 'yes') return
    await window.relay.calendar.remove(state.event.id)
    onSaved()
    onClose()
  }

  return (
    <Dialog
      open
      title={state.event ? t.event.editTitle : t.event.newTitle}
      onClose={onClose}
      className="event-dialog"
      actions={
        <>
          {state.event && (
            <Button variant="ghost" onClick={() => void remove()}>
              {t.event.remove}
            </Button>
          )}
          <Button onClick={onClose}>{t.dialogs.cancel}</Button>
          <Button variant="primary" onClick={() => void save()}>
            {t.event.save}
          </Button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <TextField label={t.event.title} value={title} autoFocus onChange={(event) => setTitle(event.target.value)} />
        <label className="check">
          <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
          {t.event.allDay}
        </label>
        <div className="form-row">
          <TextField label={t.event.date} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          {allDay ? (
            <TextField label={t.event.endDate} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          ) : (
            <div className="form-row">
              <TextField label={t.event.start} type="time" value={start} onChange={(event) => setStart(event.target.value)} />
              <TextField label={t.event.end} type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
            </div>
          )}
        </div>
        <TextField label={t.event.location} value={location} onChange={(event) => setLocation(event.target.value)} />
        <label className="field">
          <span className="field__label">{t.event.notes}</span>
          <textarea className="textarea" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t.event.reminder}</span>
          <select className="select" value={reminder} onChange={(event) => setReminder(Number(event.target.value))}>
            {t.event.reminders.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {recurrenceAllowed && (
          <fieldset className="repeat">
            <legend>{t.event.repeat}</legend>
            <select className="select" aria-label={t.event.repeat} value={repeat} onChange={(event) => setRepeat(event.target.value as Repeat)}>
              <option value="none">{t.event.repeatNone}</option>
              <option value="daily">{t.event.repeatDaily}</option>
              <option value="weekly">{t.event.repeatWeekly}</option>
              <option value="monthly">{t.event.repeatMonthly}</option>
            </select>
            {repeat !== 'none' && (
              <>
                <label className="field-inline">
                  {t.event.every}
                  <input className="number" type="number" min={1} max={99} value={interval} onChange={(event) => setInterval(Number(event.target.value))} />
                  {t.event.intervalUnit[repeat]}
                </label>
                <label className="field-inline">
                  {t.event.ends}
                  <select className="select" value={ends} onChange={(event) => setEnds(event.target.value as Ends)}>
                    <option value="never">{t.event.endsNever}</option>
                    <option value="until">{t.event.endsOn}</option>
                    <option value="count">{t.event.endsAfter}</option>
                  </select>
                </label>
                {ends === 'until' && <TextField label={t.event.endsOn} type="date" value={until} onChange={(event) => setUntil(event.target.value)} />}
                {ends === 'count' && (
                  <label className="field-inline">
                    {t.event.count}
                    <input className="number" type="number" min={1} max={999} value={count} onChange={(event) => setCount(Number(event.target.value))} />
                  </label>
                )}
                {state.event?.recurrence && <p className="hint">{t.event.seriesNote}</p>}
              </>
            )}
          </fieldset>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
