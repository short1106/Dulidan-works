import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight, FileUp } from 'lucide-react'
import { Button, cx, IconButton, notify } from '@dulidan/design-system'
import { addDays } from '@dulidan/mail-core/time'
import type { CalendarOccurrence } from '../../../shared/ipc'
import { can } from '../features'
import { t } from '../i18n'
import { errorText } from '../state/mail'
import { useMode } from '../state/settings'
import { dateOf, daysCovered, dayKey, fromDayKey, germanDate, isoWeek, monthGrid, rangeOf, shiftMonth, timeOf, today, weekDays, type DayKey } from './dates'
import { EventDialog, type EventDialogState } from './EventDialog'

const HOUR_HEIGHT = 48

function useOccurrences(days: DayKey[]): [CalendarOccurrence[], () => void] {
  const [items, setItems] = useState<CalendarOccurrence[]>([])
  const key = `${days[0]}-${days[days.length - 1]}`
  const load = useCallback(() => {
    const [from, to] = rangeOf(days)
    void window.relay.calendar.range(from, to).then(setItems)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    load()
    return window.relay.events.onChanged(load)
  }, [load])
  return [items, load]
}

function byDay(items: CalendarOccurrence[]): Map<DayKey, CalendarOccurrence[]> {
  const map = new Map<DayKey, CalendarOccurrence[]>()
  for (const item of items) {
    for (const day of daysCovered(item.occurrence.startLocal, item.occurrence.endLocal, item.event.allDay)) {
      map.set(day, [...(map.get(day) ?? []), item])
    }
  }
  return map
}

function EventChip({ item, onOpen }: { item: CalendarOccurrence; onOpen: () => void }): React.JSX.Element {
  return (
    <button type="button" className={cx('event-chip', item.event.allDay && 'is-all-day')} onClick={onOpen} title={item.event.location || item.event.title}>
      {!item.event.allDay && <span className="event-chip__time">{timeOf(item.occurrence.startLocal)}</span>}
      <span className="event-chip__title">{item.event.title}</span>
    </button>
  )
}

export function CalendarView(): React.JSX.Element {
  const mode = useMode()
  const [view, setView] = useState<'month' | 'week'>('month')
  const [anchor, setAnchor] = useState(today)
  const [selected, setSelected] = useState<DayKey>(dayKey(today()))
  const [dialog, setDialog] = useState<EventDialogState | null>(null)
  const weekView = view === 'week' && can('calendarWeek', mode)
  const days = useMemo(() => (weekView ? weekDays(anchor) : monthGrid(anchor.year, anchor.month)), [anchor, weekView])
  const [items, reload] = useOccurrences(days)
  const map = useMemo(() => byDay(items), [items])
  const todayKey = dayKey(today())

  // The week view opens on the selected day if it is in the month on screen.
  const switchView = (next: 'month' | 'week'): void => {
    const picked = fromDayKey(selected)
    if (next === 'week' && !weekView && picked.year === anchor.year && picked.month === anchor.month) setAnchor(picked)
    setView(next)
  }
  const move = (direction: 1 | -1): void => setAnchor((current) => (weekView ? addDays(current, direction * 7) : shiftMonth(current, direction)))
  const title = weekView
    ? `${t.calendar.weekLabel(isoWeek(anchor))} · ${germanDate(days[0]!)} – ${germanDate(days[6]!)}`
    : `${t.calendar.months[anchor.month - 1]} ${anchor.year}`

  const importFile = async (): Promise<void> => {
    const result = await window.relay.calendar.importFile()
    if (!result.ok) return notify(errorText(result.error), 'error')
    if (!result.value) return
    notify(t.reader.imported(result.value.added, result.value.updated), 'success')
    if (result.value.simplified.length > 0) notify(t.reader.simplified(result.value.simplified.join(', ')), 'info')
    reload()
  }

  return (
    <section className="calendar" aria-label={t.nav.calendar}>
      <header className="calendar__head">
        <IconButton icon={<ChevronLeft />} label={t.calendar.previous} onClick={() => move(-1)} />
        <Button onClick={() => {
          setAnchor(today())
          setSelected(todayKey)
        }}>{t.calendar.today}</Button>
        <IconButton icon={<ChevronRight />} label={t.calendar.next} onClick={() => move(1)} />
        <h2 className="calendar__title" aria-live="polite">{title}</h2>
        <span className="toolbar__spacer" />
        {can('calendarWeek', mode) && (
          <div className="segmented" role="radiogroup" aria-label={t.calendar.month}>
            {(['month', 'week'] as const).map((value) => (
              <button key={value} type="button" role="radio" aria-checked={view === value} className={cx('segmented__item', view === value && 'is-selected')} onClick={() => switchView(value)}>
                {value === 'month' ? t.calendar.month : t.calendar.week}
              </button>
            ))}
          </div>
        )}
        {can('importIcs', mode) && <Button icon={<FileUp />} onClick={() => void importFile()}>{t.calendar.importIcs}</Button>}
        <Button variant="primary" icon={<CalendarPlus />} onClick={() => setDialog({ event: null, day: selected })}>
          {t.calendar.newEvent}
        </Button>
      </header>

      {weekView ? (
        <div className="week">
          <div className="week__head">
            <span />
            {days.map((day, index) => (
              <div key={day} className={cx('week__day-head', day === todayKey && 'is-today')}>
                {t.calendar.weekdays[index]} {germanDate(day).slice(0, 6)}
                {(map.get(day) ?? []).filter((item) => item.event.allDay).map((item) => (
                  <EventChip key={`${item.event.id}-${item.occurrence.index}`} item={item} onOpen={() => setDialog({ event: item.event, day })} />
                ))}
              </div>
            ))}
          </div>
          <div className="week__body" ref={(element) => {
            if (element && element.scrollTop === 0) element.scrollTop = HOUR_HEIGHT * 7
          }}>
            <div className="week__hours">
              {Array.from({ length: 24 }, (_, hour) => (
                <span key={hour} style={{ height: HOUR_HEIGHT }}>{`${String(hour).padStart(2, '0')}:00`}</span>
              ))}
            </div>
            {days.map((day) => (
              <div
                key={day}
                className={cx('week__column', day === todayKey && 'is-today')}
                style={{ height: HOUR_HEIGHT * 24 }}
                onDoubleClick={() => setDialog({ event: null, day })}
              >
                {(map.get(day) ?? [])
                  .filter((item) => !item.event.allDay)
                  .map((item) => {
                    const startsToday = dateOf(item.occurrence.startLocal) === day
                    const endsToday = dateOf(item.occurrence.endLocal) === day
                    const [sh, sm] = (startsToday ? timeOf(item.occurrence.startLocal) : '00:00').split(':').map(Number) as [number, number]
                    const [eh, em] = (endsToday ? timeOf(item.occurrence.endLocal) : '24:00').split(':').map(Number) as [number, number]
                    const top = (sh + sm / 60) * HOUR_HEIGHT
                    const height = Math.max(22, (eh + em / 60 - sh - sm / 60) * HOUR_HEIGHT)
                    return (
                      <button
                        key={`${item.event.id}-${item.occurrence.index}`}
                        type="button"
                        className="week__event"
                        style={{ top, height }}
                        onClick={() => setDialog({ event: item.event, day })}
                      >
                        <strong>{item.event.title}</strong>
                        <span>
                          {timeOf(item.occurrence.startLocal)}–{timeOf(item.occurrence.endLocal)}
                          {item.event.location ? ` · ${item.event.location}` : ''}
                        </span>
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="month" role="grid" aria-label={title}>
          <div className="month__weekdays" role="row">
            {t.calendar.weekdays.map((name, index) => (
              <span key={name} role="columnheader" aria-label={t.calendar.weekdaysLong[index]}>
                {name}
              </span>
            ))}
          </div>
          <div className="month__grid">
            {days.map((day) => {
              const list = map.get(day) ?? []
              const outside = fromDayKey(day).month !== anchor.month
              return (
                <div
                  key={day}
                  role="gridcell"
                  aria-selected={day === selected}
                  className={cx('month__cell', outside && 'is-outside', day === todayKey && 'is-today', day === selected && 'is-selected')}
                  onClick={() => setSelected(day)}
                  onDoubleClick={() => setDialog({ event: null, day })}
                >
                  <button
                    type="button"
                    className="month__day"
                    aria-label={`${germanDate(day)}${list.length ? `, ${list.length} Termin(e)` : ''}`}
                    onClick={() => setSelected(day)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') setDialog({ event: null, day })
                    }}
                  >
                    {fromDayKey(day).day}
                  </button>
                  {list.slice(0, 3).map((item) => (
                    <EventChip key={`${item.event.id}-${item.occurrence.index}`} item={item} onOpen={() => setDialog({ event: item.event, day })} />
                  ))}
                  {list.length > 3 && <span className="month__more">{t.calendar.more(list.length - 3)}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
      <p className="calendar__note">{t.calendar.timeZoneNote}</p>
      <EventDialog state={dialog} onClose={() => setDialog(null)} onSaved={reload} />
    </section>
  )
}
