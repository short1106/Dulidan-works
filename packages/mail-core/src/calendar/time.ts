/**
 * Time zone arithmetic for calendar and daily limits, without libraries.
 *
 * Appointments are stored as local "wall clock" time (e.g. 10:00 in Berlin)
 * plus the time zone. That way a weekly meeting at 10:00 stays at 10:00
 * after the change to or from daylight saving time.
 */

export const DEFAULT_TIME_ZONE = 'Europe/Berlin'

export interface LocalDateTime {
  year: number
  /** 1 to 12 */
  month: number
  day: number
  hour: number
  minute: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
    formatters.set(timeZone, format)
  }
  return format
}

/** Local wall time of a moment in a time zone. */
export function utcToLocal(utcMs: number, timeZone = DEFAULT_TIME_ZONE): LocalDateTime {
  const parts: Record<string, number> = {}
  for (const part of formatter(timeZone).formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return { year: parts['year']!, month: parts['month']!, day: parts['day']!, hour: parts['hour']!, minute: parts['minute']! }
}

/** Difference to UTC in minutes at a moment, e.g. 60 in winter and 120 in summer for Berlin. */
export function offsetMinutes(utcMs: number, timeZone = DEFAULT_TIME_ZONE): number {
  const local = utcToLocal(utcMs, timeZone)
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
  return Math.round((asUtc - Math.floor(utcMs / 60_000) * 60_000) / 60_000)
}

/**
 * The moment of a local wall time.
 * - Times that do not exist (spring forward, 02:30) move forward by the gap (03:30).
 * - Times that exist twice (fall back, 02:30) use the first one (summer time).
 */
export function localToUtc(local: LocalDateTime, timeZone = DEFAULT_TIME_ZONE): number {
  const naive = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
  const offsetBefore = offsetMinutes(naive - 12 * 3_600_000, timeZone)
  const offsetAfter = offsetMinutes(naive + 12 * 3_600_000, timeZone)
  // Earlier offset first: for doubled times this picks the first moment.
  for (const offset of [Math.max(offsetBefore, offsetAfter), Math.min(offsetBefore, offsetAfter)]) {
    const candidate = naive - offset * 60_000
    const back = utcToLocal(candidate, timeZone)
    if (back.year === local.year && back.month === local.month && back.day === local.day && back.hour === local.hour && back.minute === local.minute) {
      return candidate
    }
  }
  // Not existing (gap): same clock reading with the offset from before the gap.
  return naive - offsetBefore * 60_000
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addDays(local: LocalDateTime, days: number): LocalDateTime {
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day + days))
  return { ...local, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

/** Same day number some months later, or null if that month is too short (e.g. 31 February). */
export function addMonths(local: LocalDateTime, months: number): LocalDateTime | null {
  const total = local.year * 12 + (local.month - 1) + months
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  if (local.day > daysInMonth(year, month)) return null
  return { ...local, year, month }
}

/** 0 = Monday ... 6 = Sunday. */
export function weekday(local: LocalDateTime): number {
  return (new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay() + 6) % 7
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0')

/** "2026-10-25T10:00" */
export function formatLocal(local: LocalDateTime): string {
  return `${pad(local.year, 4)}-${pad(local.month)}-${pad(local.day)}T${pad(local.hour)}:${pad(local.minute)}`
}

/** Reads "2026-10-25T10:00" or "2026-10-25" (midnight). */
export function parseLocal(value: string): LocalDateTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value)
  if (!match) return null
  const local = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4] ?? 0), minute: Number(match[5] ?? 0) }
  if (local.month < 1 || local.month > 12 || local.day < 1 || local.day > daysInMonth(local.year, local.month) || local.hour > 23 || local.minute > 59) {
    return null
  }
  return local
}

/** Start of the local day (00:00) as a moment, e.g. for "mails sent today". */
export function startOfLocalDay(utcMs: number, timeZone = DEFAULT_TIME_ZONE): number {
  const local = utcToLocal(utcMs, timeZone)
  return localToUtc({ ...local, hour: 0, minute: 0 }, timeZone)
}

export function compareLocal(a: LocalDateTime, b: LocalDateTime): number {
  return formatLocal(a).localeCompare(formatLocal(b))
}
