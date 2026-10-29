import { describe, expect, it } from 'vitest'
import { expandOccurrences, validateEvent, type CalendarEvent, type CalendarEventInput } from '../src/calendar/events'
import { parseIcs, parseRecurrenceRule } from '../src/calendar/ics'
import { CalendarStore } from '../src/calendar/store'
import { addMonths, localToUtc, offsetMinutes, parseLocal, startOfLocalDay, utcToLocal } from '../src/calendar/time'
import { openDatabase } from '../src/sqlite'

const utc = (iso: string): number => Date.parse(iso)

function event(patch: Partial<CalendarEventInput> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Termin',
    location: '',
    notes: '',
    start: '2026-10-20T10:00',
    end: '2026-10-20T11:00',
    allDay: false,
    timeZone: 'Europe/Berlin',
    recurrence: null,
    reminderMinutes: null,
    ...patch
  }
}

describe('Europe/Berlin time', () => {
  it('knows summer and winter time', () => {
    expect(offsetMinutes(utc('2026-07-01T12:00:00Z'))).toBe(120)
    expect(offsetMinutes(utc('2026-12-01T12:00:00Z'))).toBe(60)
    expect(localToUtc({ year: 2026, month: 7, day: 1, hour: 10, minute: 0 })).toBe(utc('2026-07-01T08:00:00Z'))
    expect(localToUtc({ year: 2026, month: 12, day: 1, hour: 10, minute: 0 })).toBe(utc('2026-12-01T09:00:00Z'))
  })

  it('moves a time that does not exist (spring forward) behind the gap', () => {
    // 29 March 2026: clocks jump from 02:00 to 03:00.
    const moment = localToUtc({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 })
    expect(utcToLocal(moment)).toMatchObject({ hour: 3, minute: 30 })
  })

  it('uses the first of two equal times (fall back)', () => {
    // 25 October 2026: 02:00-03:00 happens twice; the first is still summer time.
    expect(localToUtc({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 })).toBe(utc('2026-10-25T00:30:00Z'))
  })

  it('finds the start of the local day and validates dates', () => {
    expect(startOfLocalDay(utc('2026-07-10T15:00:00Z'))).toBe(utc('2026-07-09T22:00:00Z'))
    expect(parseLocal('2026-02-30T10:00')).toBeNull()
    expect(parseLocal('2026-02-28')).toMatchObject({ hour: 0 })
    expect(addMonths({ year: 2026, month: 1, day: 31, hour: 0, minute: 0 }, 1)).toBeNull()
  })
})

describe('series', () => {
  it('keeps a weekly meeting at 10:00 local time across the change to winter time', () => {
    const series = event({ recurrence: { frequency: 'weekly', interval: 1, count: 3 } })
    const list = expandOccurrences(series, utc('2026-10-01T00:00:00Z'), utc('2026-12-01T00:00:00Z'))
    expect(list.map((o) => o.startLocal)).toEqual(['2026-10-20T10:00', '2026-10-27T10:00', '2026-11-03T10:00'])
    // 08:00 UTC in summer time, 09:00 UTC after the change on 25 October.
    expect(list.map((o) => new Date(o.startUtc).toISOString().slice(11, 16))).toEqual(['08:00', '09:00', '09:00'])
  })

  it('supports daily series with an end date and an interval', () => {
    const series = event({ start: '2026-03-27T09:00', end: '2026-03-27T09:30', recurrence: { frequency: 'daily', interval: 2, until: '2026-04-02' } })
    const list = expandOccurrences(series, utc('2026-01-01T00:00:00Z'), utc('2027-01-01T00:00:00Z'))
    expect(list.map((o) => o.startLocal.slice(0, 10))).toEqual(['2026-03-27', '2026-03-29', '2026-03-31', '2026-04-02'])
  })

  it('skips months without the day for monthly series on the 31st', () => {
    const series = event({ start: '2026-01-31T18:00', end: '2026-01-31T19:00', recurrence: { frequency: 'monthly', interval: 1, count: 4 } })
    const list = expandOccurrences(series, utc('2026-01-01T00:00:00Z'), utc('2027-01-01T00:00:00Z'))
    expect(list.map((o) => o.startLocal.slice(0, 10))).toEqual(['2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31'])
  })

  it('returns only the occurrences in the requested range', () => {
    const series = event({ recurrence: { frequency: 'daily', interval: 1 } })
    const list = expandOccurrences(series, utc('2027-01-05T00:00:00Z'), utc('2027-01-07T00:00:00Z'))
    expect(list.map((o) => o.startLocal)).toEqual(['2027-01-05T10:00', '2027-01-06T10:00'])
  })

  it('validates events', () => {
    expect(validateEvent(event())).toEqual([])
    expect(validateEvent(event({ title: ' ', end: '2026-10-20T09:00' }))).toEqual(['title', 'end'])
  })
})

describe('CalendarStore', () => {
  it('adds, changes and removes events', () => {
    const store = new CalendarStore(openDatabase(':memory:'))
    const added = store.add(event({ title: 'Zahnarzt', location: 'Praxis', notes: 'Karte mitnehmen' }))
    store.update(added.id, { ...added, title: 'Zahnarzt (verschoben)', start: '2026-10-21T10:00', end: '2026-10-21T11:00' })
    expect(store.get(added.id)?.title).toBe('Zahnarzt (verschoben)')
    expect(store.occurrences(utc('2026-10-21T00:00:00Z'), utc('2026-10-22T00:00:00Z'))).toHaveLength(1)
    store.remove(added.id)
    expect(store.list()).toEqual([])
  })

  it('shows each reminder exactly once, also for series', () => {
    const store = new CalendarStore(openDatabase(':memory:'))
    store.add(event({ reminderMinutes: 15, recurrence: { frequency: 'daily', interval: 1, count: 2 } }))
    // 10:00 Berlin = 08:00 UTC; reminder at 07:45 UTC.
    expect(store.takeDueReminders(utc('2026-10-20T07:40:00Z'))).toHaveLength(0)
    expect(store.takeDueReminders(utc('2026-10-20T07:46:00Z'))).toHaveLength(1)
    expect(store.takeDueReminders(utc('2026-10-20T07:50:00Z'))).toHaveLength(0)
    const next = store.takeDueReminders(utc('2026-10-21T07:50:00Z'))
    expect(next.map((r) => r.occurrence.startLocal)).toEqual(['2026-10-21T10:00'])
  })

  it('creates follow-up reminders some days later at 9:00 (for Radar)', () => {
    const store = new CalendarStore(openDatabase(':memory:'))
    const followUp = store.addFollowUp({ title: 'Nachfassen: Tischlerei Holz', afterDays: 7, relatedMessageId: '<abc@x>', now: utc('2026-10-20T15:00:00Z') })
    expect(followUp).toMatchObject({ start: '2026-10-27T09:00', reminderMinutes: 0, relatedMessageId: '<abc@x>' })
  })
})

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//DE
BEGIN:VEVENT
UID:serie-1@test
DTSTART;TZID=Europe/Berlin:20261020T100000
DTEND;TZID=Europe/Berlin:20261020T113000
SUMMARY:Team-Treffen
LOCATION:Büro
DESCRIPTION:Erste Zeile\\nzweite Zeile
RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=5
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
END:VALARM
END:VEVENT
BEGIN:VEVENT
UID:frei-1@test
DTSTART;VALUE=DATE:20261103
DTEND;VALUE=DATE:20261104
SUMMARY:Feiertag
END:VEVENT
BEGIN:VEVENT
UID:utc-1@test
DTSTART:20261105T090000Z
DTEND:20261105T100000Z
SUMMARY:UTC-Termin
RRULE:FREQ=WEEKLY;BYDAY=MO,WE
END:VEVENT
END:VCALENDAR`

describe('.ics import', () => {
  it('reads events, series, all-day events and reminders in Berlin time', () => {
    const { events, simplified } = parseIcs(ICS)
    const byUid = Object.fromEntries(events.map((item) => [item.icsUid, item]))
    expect(byUid['serie-1@test']).toMatchObject({
      title: 'Team-Treffen',
      location: 'Büro',
      notes: 'Erste Zeile\nzweite Zeile',
      start: '2026-10-20T10:00',
      end: '2026-10-20T11:30',
      recurrence: { frequency: 'weekly', interval: 2, count: 5 },
      reminderMinutes: 15
    })
    expect(byUid['frei-1@test']).toMatchObject({ allDay: true, start: '2026-11-03T00:00', end: '2026-11-03T00:00' })
    // 09:00 UTC is 10:00 in Berlin (winter time).
    expect(byUid['utc-1@test']).toMatchObject({ start: '2026-11-05T10:00', recurrence: null })
    expect(simplified).toEqual(['UTC-Termin'])
  })

  it('updates instead of duplicating on a second import', () => {
    const store = new CalendarStore(openDatabase(':memory:'))
    expect(store.importEvents(parseIcs(ICS).events)).toEqual({ added: 3, updated: 0 })
    expect(store.importEvents(parseIcs(ICS).events)).toEqual({ added: 0, updated: 3 })
    expect(store.list()).toHaveLength(3)
  })

  it('accepts only supported rules', () => {
    const start = { year: 2026, month: 10, day: 20, hour: 10, minute: 0 }
    expect(parseRecurrenceRule('RRULE:FREQ=MONTHLY;UNTIL=20270101T000000Z', start)).toEqual({ frequency: 'monthly', interval: 1, count: null, until: '2027-01-01' })
    expect(parseRecurrenceRule('FREQ=WEEKLY;BYDAY=TU', start)?.frequency).toBe('weekly')
    expect(parseRecurrenceRule('FREQ=YEARLY', start)).toBeNull()
  })
})
