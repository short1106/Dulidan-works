import { addDays, DEFAULT_TIME_ZONE, formatLocal, localToUtc, utcToLocal, weekday, type LocalDateTime } from '@dulidan/mail-core/time'

/** A calendar day without time, e.g. "2026-10-29". */
export type DayKey = string

export function dayKey(local: LocalDateTime): DayKey {
  return formatLocal(local).slice(0, 10)
}

export function fromDayKey(key: DayKey): LocalDateTime {
  const [year, month, day] = key.split('-').map(Number) as [number, number, number]
  return { year, month, day, hour: 0, minute: 0 }
}

export function today(): LocalDateTime {
  return { ...utcToLocal(Date.now(), DEFAULT_TIME_ZONE), hour: 0, minute: 0 }
}

/** 6 weeks x 7 days, starting on the Monday before the 1st. */
export function monthGrid(year: number, month: number): DayKey[] {
  const first: LocalDateTime = { year, month, day: 1, hour: 0, minute: 0 }
  const start = addDays(first, -weekday(first))
  return Array.from({ length: 42 }, (_, index) => dayKey(addDays(start, index)))
}

export function weekDays(anchor: LocalDateTime): DayKey[] {
  const monday = addDays(anchor, -weekday(anchor))
  return Array.from({ length: 7 }, (_, index) => dayKey(addDays(monday, index)))
}

/** The time range from the first to the end of the last day, as UTC milliseconds. */
export function rangeOf(days: DayKey[]): [number, number] {
  const first = fromDayKey(days[0]!)
  const last = addDays(fromDayKey(days[days.length - 1]!), 1)
  return [localToUtc(first, DEFAULT_TIME_ZONE), localToUtc(last, DEFAULT_TIME_ZONE)]
}

/** Calendar week (ISO 8601) as used in Germany. */
export function isoWeek(local: LocalDateTime): number {
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day))
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

export function shiftMonth(local: LocalDateTime, months: number): LocalDateTime {
  const total = local.year * 12 + local.month - 1 + months
  return { ...local, year: Math.floor(total / 12), month: (total % 12) + 1, day: 1 }
}

export const timeOf = (localString: string): string => localString.slice(11, 16)
export const dateOf = (localString: string): DayKey => localString.slice(0, 10)

/** "29.10.2026" */
export function germanDate(key: DayKey): string {
  const [year, month, day] = key.split('-')
  return `${day}.${month}.${year}`
}

/** Days an occurrence covers (for events over several days). */
export function daysCovered(startLocal: string, endLocal: string, allDay: boolean): DayKey[] {
  const start = fromDayKey(dateOf(startLocal))
  const endKey = dateOf(endLocal)
  // An end at exactly 00:00 belongs to the day before (unless it is all-day).
  const endsAtMidnight = !allDay && timeOf(endLocal) === '00:00' && endKey !== dateOf(startLocal)
  const last = endsAtMidnight ? dayKey(addDays(fromDayKey(endKey), -1)) : endKey
  const days: DayKey[] = []
  for (let current = start; dayKey(current) <= last && days.length < 62; current = addDays(current, 1)) days.push(dayKey(current))
  return days
}
