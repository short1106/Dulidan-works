import ical, { type VEvent } from 'node-ical'
import type { CalendarEventInput, Frequency, Recurrence } from './events'
import { DEFAULT_TIME_ZONE, formatLocal, utcToLocal, type LocalDateTime } from './time'

export interface IcsImportResult {
  events: CalendarEventInput[]
  /** Titles of series with rules Relay does not support yet; only their first date was taken. */
  simplified: string[]
}

const FREQUENCIES: Record<string, Frequency> = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly' }
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** Reads "FREQ=WEEKLY;INTERVAL=2;COUNT=5" etc. Returns null if the rule is not supported. */
export function parseRecurrenceRule(rule: string, start: LocalDateTime): Recurrence | null {
  const parts = new Map(
    rule
      .replace(/^RRULE:/i, '')
      .split(';')
      .map((part) => part.split('=') as [string, string])
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key.toUpperCase(), value.toUpperCase()])
  )
  const frequency = FREQUENCIES[parts.get('FREQ') ?? '']
  if (!frequency) return null
  for (const key of parts.keys()) {
    if (['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'WKST'].includes(key)) continue
    // A BYDAY or BYMONTHDAY that only repeats the start day changes nothing.
    const startWeekday = WEEKDAYS[new Date(Date.UTC(start.year, start.month - 1, start.day)).getUTCDay()]
    if (key === 'BYDAY' && frequency === 'weekly' && parts.get(key) === startWeekday) continue
    if (key === 'BYMONTHDAY' && frequency === 'monthly' && Number(parts.get(key)) === start.day) continue
    return null
  }
  const until = parts.get('UNTIL')
  const untilMatch = until ? /^(\d{4})(\d{2})(\d{2})/.exec(until) : null
  return {
    frequency,
    interval: Math.max(1, Number(parts.get('INTERVAL') ?? 1) || 1),
    count: parts.has('COUNT') ? Math.max(1, Number(parts.get('COUNT'))) : null,
    until: untilMatch ? `${untilMatch[1]}-${untilMatch[2]}-${untilMatch[3]}` : null
  }
}

/** Minutes of the first VALARM of each event (by UID), e.g. "-PT15M" -> 15. */
function reminderMinutesByUid(text: string): Map<string, number> {
  const result = new Map<string, number>()
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  for (const block of unfolded.split(/BEGIN:VEVENT/i).slice(1)) {
    const uid = /\nUID:(.+)/i.exec(block)?.[1]?.trim()
    const trigger = /BEGIN:VALARM[\s\S]*?\nTRIGGER[^:]*:(-?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/i.exec(block)
    if (!uid || !trigger) continue
    const [, sign, weeks, days, hours, minutes] = trigger
    const total = Number(weeks ?? 0) * 10080 + Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0)
    // Only reminders before the start are supported.
    result.set(uid, sign === '-' || total === 0 ? total : 0)
  }
  return result
}

function dateOnlyLocal(date: Date): LocalDateTime {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: 0, minute: 0 }
}

/**
 * Reads an .ics file (e.g. an invitation attached to a mail).
 * All times are converted to Europe/Berlin wall time.
 */
export function parseIcs(text: string, timeZone = DEFAULT_TIME_ZONE): IcsImportResult {
  const data = ical.sync.parseICS(text)
  const reminders = reminderMinutesByUid(text)
  const result: IcsImportResult = { events: [], simplified: [] }

  for (const component of Object.values(data)) {
    if (!component || component.type !== 'VEVENT' || !component.start) continue
    const event = component as VEvent
    const allDay = event.datetype === 'date'
    const start = allDay ? dateOnlyLocal(event.start) : utcToLocal(event.start.getTime(), timeZone)
    const endDate = event.end ?? event.start
    let end = allDay ? dateOnlyLocal(endDate) : utcToLocal(endDate.getTime(), timeZone)
    // In .ics files all-day events end on the next day (exclusive); we store the last day.
    if (allDay && formatLocal(end) > formatLocal(start)) {
      const last = new Date(Date.UTC(end.year, end.month - 1, end.day - 1))
      end = dateOnlyLocal(last)
    }

    let recurrence: Recurrence | null = null
    if (event.rrule) {
      const ruleLine = String(event.rrule.toString())
        .split('\n')
        .find((line) => line.toUpperCase().startsWith('RRULE:'))
      recurrence = ruleLine ? parseRecurrenceRule(ruleLine, start) : null
      if (!recurrence) result.simplified.push(String(event.summary ?? ''))
    }

    const text = (value: unknown): string =>
      typeof value === 'string' ? value : value && typeof value === 'object' && 'val' in value ? String((value as { val: unknown }).val) : ''

    result.events.push({
      title: text(event.summary).trim() || 'Termin',
      location: text(event.location).trim(),
      notes: text(event.description).trim(),
      start: formatLocal(start),
      end: formatLocal(end),
      allDay,
      timeZone,
      recurrence,
      reminderMinutes: event.uid ? (reminders.get(event.uid) ?? null) : null,
      icsUid: event.uid ?? null,
      relatedMessageId: null
    })
  }
  return result
}
