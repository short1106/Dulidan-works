import { addDays, addMonths, compareLocal, DEFAULT_TIME_ZONE, formatLocal, localToUtc, parseLocal, type LocalDateTime } from './time'

/**
 * Appointments and series. Start and end are local wall times in the
 * appointment's time zone ("2026-11-02T10:00" in Europe/Berlin).
 */

export type Frequency = 'daily' | 'weekly' | 'monthly'

export interface Recurrence {
  frequency: Frequency
  /** Every n days/weeks/months, at least 1. */
  interval: number
  /** Last possible day of the series ("2026-12-31"), inclusive. */
  until?: string | null
  /** Number of appointments in the series. */
  count?: number | null
}

export interface CalendarEventInput {
  title: string
  location: string
  notes: string
  /** "YYYY-MM-DDTHH:mm" local time; for all-day events the time is 00:00. */
  start: string
  end: string
  allDay: boolean
  timeZone: string
  recurrence: Recurrence | null
  /** Minutes before the start; null = no reminder. */
  reminderMinutes: number | null
  /** Identifies events from .ics files, so a second import updates instead of duplicating. */
  icsUid?: string | null
  /** E.g. the Message-ID of a mail this reminder belongs to (Radar follow-ups). */
  relatedMessageId?: string | null
}

export interface CalendarEvent extends CalendarEventInput {
  id: string
}

/** One appearance of an event (a single event has exactly one). */
export interface Occurrence {
  eventId: string
  /** Index in the series, 0 for the first. */
  index: number
  startLocal: string
  endLocal: string
  startUtc: number
  endUtc: number
}

/** Safety limit when expanding endless series. */
const MAX_OCCURRENCES = 5000

export function validateEvent(input: CalendarEventInput): string[] {
  const errors: string[] = []
  const start = parseLocal(input.start)
  const end = parseLocal(input.end)
  if (!input.title.trim()) errors.push('title')
  if (!start) errors.push('start')
  if (!end) errors.push('end')
  if (start && end && compareLocal(end, start) < 0) errors.push('end')
  if (input.reminderMinutes !== null && (!Number.isInteger(input.reminderMinutes) || input.reminderMinutes < 0)) errors.push('reminder')
  if (input.recurrence) {
    if (!['daily', 'weekly', 'monthly'].includes(input.recurrence.frequency)) errors.push('recurrence')
    if (!Number.isInteger(input.recurrence.interval) || input.recurrence.interval < 1) errors.push('recurrence')
    if (input.recurrence.until && !parseLocal(input.recurrence.until)) errors.push('recurrence')
  }
  try {
    new Intl.DateTimeFormat('de', { timeZone: input.timeZone || DEFAULT_TIME_ZONE })
  } catch {
    errors.push('timeZone')
  }
  return errors
}

/** Length of an event in minutes of wall time, kept for every occurrence. */
function durationMinutes(start: LocalDateTime, end: LocalDateTime): number {
  return (Date.UTC(end.year, end.month - 1, end.day, end.hour, end.minute) - Date.UTC(start.year, start.month - 1, start.day, start.hour, start.minute)) / 60_000
}

function addMinutes(local: LocalDateTime, minutes: number): LocalDateTime {
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute + minutes))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes() }
}

/** The n-th date of a series, or null if it does not exist (31st in a short month). */
function nthStart(first: LocalDateTime, recurrence: Recurrence, n: number): LocalDateTime | null {
  const step = n * recurrence.interval
  switch (recurrence.frequency) {
    case 'daily':
      return addDays(first, step)
    case 'weekly':
      return addDays(first, step * 7)
    case 'monthly':
      // Like most calendars: months without that day are skipped.
      return addMonths(first, step)
  }
}

/**
 * All appearances of an event that overlap [fromUtc, toUtc).
 * Series keep their wall-clock time across daylight saving changes.
 */
export function expandOccurrences(event: CalendarEvent, fromUtc: number, toUtc: number): Occurrence[] {
  const start = parseLocal(event.start)
  const end = parseLocal(event.end)
  if (!start || !end) return []
  const zone = event.timeZone || DEFAULT_TIME_ZONE
  const minutes = durationMinutes(start, end)
  const until = event.recurrence?.until ? parseLocal(event.recurrence.until) : null
  const untilEnd = until ? { ...until, hour: 23, minute: 59 } : null
  const result: Occurrence[] = []
  const limit = event.recurrence ? Math.min(event.recurrence.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES) : 1

  for (let n = 0, index = 0; index < limit && n < MAX_OCCURRENCES * 2; n++) {
    const occurrenceStart = event.recurrence ? nthStart(start, event.recurrence, n) : start
    if (!occurrenceStart) continue // skipped month, does not count
    if (untilEnd && compareLocal(occurrenceStart, untilEnd) > 0) break
    const occurrenceEnd = addMinutes(occurrenceStart, minutes)
    const startUtc = localToUtc(occurrenceStart, zone)
    const endUtc = localToUtc(occurrenceEnd, zone)
    if (startUtc >= toUtc) break
    if (endUtc > fromUtc || (endUtc === startUtc && startUtc >= fromUtc)) {
      result.push({ eventId: event.id, index, startLocal: formatLocal(occurrenceStart), endLocal: formatLocal(occurrenceEnd), startUtc, endUtc })
    }
    index++
  }
  return result
}
