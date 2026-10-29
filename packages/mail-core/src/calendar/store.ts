import { randomUUID } from 'node:crypto'
import type { Database } from '../sqlite'
import { expandOccurrences, validateEvent, type CalendarEvent, type CalendarEventInput, type Occurrence } from './events'
import { addDays, DEFAULT_TIME_ZONE, formatLocal, localToUtc, utcToLocal } from './time'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  ics_uid TEXT,
  related_message_id TEXT
);
CREATE INDEX IF NOT EXISTS calendar_events_ics ON calendar_events (ics_uid);
CREATE TABLE IF NOT EXISTS calendar_reminders_done (
  event_id TEXT NOT NULL,
  occurrence INTEGER NOT NULL,
  PRIMARY KEY (event_id, occurrence)
);
`

export interface DueReminder {
  event: CalendarEvent
  occurrence: Occurrence
}

/**
 * The local calendar. It is also the interface for reminders created by
 * other programs, e.g. Radar's "nach 7 Tagen nachfassen".
 */
export class CalendarStore {
  constructor(private readonly db: Database) {
    db.exec(SCHEMA)
  }

  list(): CalendarEvent[] {
    return (this.db.prepare('SELECT id, data FROM calendar_events').all() as Array<{ id: string; data: string }>).map((row) => ({
      ...(JSON.parse(row.data) as CalendarEventInput),
      id: row.id
    }))
  }

  get(id: string): CalendarEvent | null {
    const row = this.db.prepare('SELECT data FROM calendar_events WHERE id = ?').get(id) as { data: string } | undefined
    return row ? { ...(JSON.parse(row.data) as CalendarEventInput), id } : null
  }

  add(input: CalendarEventInput): CalendarEvent {
    this.ensureValid(input)
    const event: CalendarEvent = { ...input, id: randomUUID() }
    this.db
      .prepare('INSERT INTO calendar_events (id, data, ics_uid, related_message_id) VALUES (?, ?, ?, ?)')
      .run(event.id, JSON.stringify(input), input.icsUid ?? null, input.relatedMessageId ?? null)
    return event
  }

  update(id: string, input: CalendarEventInput): CalendarEvent {
    this.ensureValid(input)
    const result = this.db
      .prepare('UPDATE calendar_events SET data = ?, ics_uid = ?, related_message_id = ? WHERE id = ?')
      .run(JSON.stringify(input), input.icsUid ?? null, input.relatedMessageId ?? null, id)
    if (Number(result.changes) === 0) throw new Error('Unknown event')
    // Changed times: reminders may fire again.
    this.db.prepare('DELETE FROM calendar_reminders_done WHERE event_id = ?').run(id)
    return { ...input, id }
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id)
    this.db.prepare('DELETE FROM calendar_reminders_done WHERE event_id = ?').run(id)
  }

  findByIcsUid(uid: string): CalendarEvent | null {
    const row = this.db.prepare('SELECT id FROM calendar_events WHERE ics_uid = ?').get(uid) as { id: string } | undefined
    return row ? this.get(row.id) : null
  }

  /** Adds new events, updates those already imported from the same .ics (same UID). */
  importEvents(inputs: CalendarEventInput[]): { added: number; updated: number } {
    let added = 0
    let updated = 0
    for (const input of inputs) {
      const existing = input.icsUid ? this.findByIcsUid(input.icsUid) : null
      if (existing) {
        this.update(existing.id, input)
        updated++
      } else {
        this.add(input)
        added++
      }
    }
    return { added, updated }
  }

  /** All appearances in a time range, sorted by start. */
  occurrences(fromUtc: number, toUtc: number): Array<{ event: CalendarEvent; occurrence: Occurrence }> {
    return this.list()
      .flatMap((event) => expandOccurrences(event, fromUtc, toUtc).map((occurrence) => ({ event, occurrence })))
      .sort((a, b) => a.occurrence.startUtc - b.occurrence.startUtc)
  }

  /**
   * Reminders that are due now and were not shown yet. Each one is marked
   * as shown, so it appears only once. Reminders missed while the app was
   * closed appear if the appointment has not started more than a day ago.
   */
  takeDueReminders(nowUtc: number): DueReminder[] {
    const due: DueReminder[] = []
    const isDone = this.db.prepare('SELECT 1 FROM calendar_reminders_done WHERE event_id = ? AND occurrence = ?')
    const markDone = this.db.prepare('INSERT OR IGNORE INTO calendar_reminders_done (event_id, occurrence) VALUES (?, ?)')
    for (const event of this.list()) {
      if (event.reminderMinutes === null) continue
      const lead = event.reminderMinutes * 60_000
      for (const occurrence of expandOccurrences(event, nowUtc - 24 * 3_600_000, nowUtc + lead + 60_000)) {
        const remindAt = occurrence.startUtc - lead
        if (remindAt > nowUtc) continue
        if (isDone.get(event.id, occurrence.index)) continue
        markDone.run(event.id, occurrence.index)
        due.push({ event, occurrence })
      }
    }
    return due
  }

  /**
   * A follow-up reminder some days from now, e.g. "nach 7 Tagen nachfassen".
   * It is placed at `hour` o'clock local time and reminds at its start.
   */
  addFollowUp(options: { title: string; notes?: string; afterDays: number; hour?: number; relatedMessageId?: string | null; now?: number; timeZone?: string }): CalendarEvent {
    const zone = options.timeZone ?? DEFAULT_TIME_ZONE
    const today = utcToLocal(options.now ?? Date.now(), zone)
    const day = addDays({ ...today, hour: options.hour ?? 9, minute: 0 }, options.afterDays)
    const end = utcToLocal(localToUtc(day, zone) + 30 * 60_000, zone)
    return this.add({
      title: options.title,
      location: '',
      notes: options.notes ?? '',
      start: formatLocal(day),
      end: formatLocal(end),
      allDay: false,
      timeZone: zone,
      recurrence: null,
      reminderMinutes: 0,
      relatedMessageId: options.relatedMessageId ?? null
    })
  }

  private ensureValid(input: CalendarEventInput): void {
    const errors = validateEvent(input)
    if (errors.length > 0) throw new Error(`Invalid event: ${[...new Set(errors)].join(', ')}`)
  }
}
