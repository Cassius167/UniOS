/**
 * Expands stored calendar events (which may recur) into concrete
 * occurrences inside a date range. Pure and timezone-aware via the host's
 * local time, which is what a student expects ("every Tuesday at 9:30").
 */
import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  endOfDay,
  format,
  startOfDay,
} from "date-fns";
import type { CalendarEvent } from "../types";

export interface Occurrence {
  /** Stable key: event id + occurrence date. */
  key: string;
  event: CalendarEvent;
  start: Date;
  end: Date;
  /** yyyy-MM-dd of this occurrence (used for exceptions). */
  dateKey: string;
  isRecurring: boolean;
}

export const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

export function expandEvent(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const first = new Date(event.start);
  const firstEnd = new Date(event.end);
  const duration = Math.max(0, firstEnd.getTime() - first.getTime());
  const out: Occurrence[] = [];

  const push = (start: Date) => {
    const end = new Date(start.getTime() + duration);
    if (end < rangeStart || start > rangeEnd) return;
    const k = dayKey(start);
    if (event.exceptions.includes(k)) return;
    out.push({ key: `${event.id}:${k}`, event, start, end, dateKey: k, isRecurring: !!event.recurrence });
  };

  const rec = event.recurrence;
  if (!rec) {
    push(first);
    return out;
  }

  const interval = Math.max(1, Math.floor(rec.interval || 1));
  const until = rec.until ? endOfDay(new Date(`${rec.until}T00:00:00`)) : null;
  const from = startOfDay(first > rangeStart ? first : addDays(rangeStart, -1));
  const to = until && until < rangeEnd ? until : rangeEnd;
  const weekdays = rec.freq === "weekly" ? (rec.byWeekday.length ? rec.byWeekday : [first.getDay()]) : [];

  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (day < startOfDay(first)) continue;
    if (rec.freq === "daily") {
      if (differenceInCalendarDays(day, first) % interval !== 0) continue;
    } else {
      if (!weekdays.includes(day.getDay())) continue;
      // Week interval measured from the series' first week (Sunday-based to stay stable).
      if (differenceInCalendarWeeks(day, first, { weekStartsOn: 0 }) % interval !== 0) continue;
    }
    const start = new Date(day);
    start.setHours(first.getHours(), first.getMinutes(), 0, 0);
    push(start);
  }
  return out;
}

export function expandEvents(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): Occurrence[] {
  return events
    .flatMap((e) => expandEvent(e, rangeStart, rangeEnd))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Moves a single (non-recurring) event, keeping its duration. */
export function moveEvent(event: CalendarEvent, newStart: Date): Pick<CalendarEvent, "start" | "end"> {
  const duration = new Date(event.end).getTime() - new Date(event.start).getTime();
  return { start: newStart.toISOString(), end: new Date(newStart.getTime() + duration).toISOString() };
}
