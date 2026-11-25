/**
 * Canvas calendar feed (.ics) parsing and merging. Pure; see feed.test.ts.
 *
 * Canvas puts assignment due dates in the feed with UIDs like
 * "event-assignment-12345" and course events as "event-calendar-event-678".
 * Assignment ids match the bookmarklet export, so both sources merge into
 * the same records.
 */
import { subDays } from "date-fns";
import type { AppData, Assignment, CalendarEvent, Course, EventType } from "../types";
import { uid } from "../ids";
import { guessType, shortCode } from "./import";

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  url: string | null;
  start: Date;
  end: Date | null;
  allDay: boolean;
}

const unescape = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

function parseIcsDate(value: string, params: string): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  if (/VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(v)) {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
    return m ? { date: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true } : null;
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  // UTC when suffixed with Z; otherwise (TZID or floating) interpret as local time.
  const date = z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return { date, allDay: false };
}

export function parseIcs(text: string): IcsEvent[] {
  // Unfold continuation lines (RFC 5545 §3.1)
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: IcsEvent[] = [];
  let cur: Partial<IcsEvent> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = { description: "", location: "", url: null, end: null, allDay: false };
    else if (line === "END:VEVENT") {
      if (cur?.uid && cur.start && cur.summary !== undefined) out.push(cur as IcsEvent);
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const [name, ...paramParts] = line.slice(0, idx).split(";");
      const params = paramParts.join(";");
      const value = line.slice(idx + 1);
      switch (name.toUpperCase()) {
        case "UID":
          cur.uid = value.trim();
          break;
        case "SUMMARY":
          cur.summary = unescape(value);
          break;
        case "DESCRIPTION":
          cur.description = unescape(value).slice(0, 2000);
          break;
        case "LOCATION":
          cur.location = unescape(value);
          break;
        case "URL":
          cur.url = value.trim();
          break;
        case "DTSTART": {
          const d = parseIcsDate(value, params);
          if (d) {
            cur.start = d.date;
            cur.allDay = d.allDay;
          }
          break;
        }
        case "DTEND": {
          const d = parseIcsDate(value, params);
          if (d) cur.end = d.date;
          break;
        }
      }
    }
  }
  return out;
}

/** "Lab 8 report [CHEM 121 101 2026W1]" → { title: "Lab 8 report", code: "CHEM 121" } */
export function splitSummary(summary: string): { title: string; code: string | null } {
  const m = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(summary);
  return m ? { title: m[1].trim() || summary, code: shortCode(m[2]) } : { title: summary, code: null };
}

function eventType(title: string): EventType {
  const t = title.toLowerCase();
  if (/exam|midterm|\btest\b/.test(t)) return "exam";
  if (/\blab\b/.test(t)) return "lab";
  if (/tutorial/.test(t)) return "tutorial";
  if (/lecture|class/.test(t)) return "lecture";
  return "meeting";
}

export interface FeedSummary {
  assignmentsCreated: number;
  assignmentsUpdated: number;
  eventsSynced: number;
  eventsRemoved: number;
  unmatchedCourses: string[];
}

export function mergeFeed(data: AppData, events: IcsEvent[], now = new Date()): { data: AppData; summary: FeedSummary } {
  const ts = now.toISOString();
  const s: FeedSummary = { assignmentsCreated: 0, assignmentsUpdated: 0, eventsSynced: 0, eventsRemoved: 0, unmatchedCourses: [] };
  const byCode = (code: string | null): Course | undefined => (code ? data.courses.find((c) => c.code.replace(/\s+/g, "").toUpperCase() === code.replace(/\s+/g, "").toUpperCase()) : undefined);
  const unmatched = new Set<string>();
  let assignments = [...data.assignments];
  const feedEvents: CalendarEvent[] = [];

  for (const e of events) {
    const { title, code } = splitSummary(e.summary);
    const course = byCode(code);
    if (code && !course) unmatched.add(code);
    const asg = /^event-assignment-(\d+)/.exec(e.uid) ?? /assignment[_-](\d+)/.exec(e.uid);

    if (asg) {
      const canvasId = asg[1];
      // Canvas uses all-day DTSTART for assignments due at 23:59 in some setups; keep end of day.
      const due = e.allDay ? new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate(), 23, 59) : e.start;
      const existing = assignments.find((x) => x.external?.source === "canvas" && x.external.id === canvasId);
      if (existing) {
        if (existing.dueAt !== due.toISOString() || existing.title !== title) {
          assignments = assignments.map((x) => (x.id === existing.id ? { ...x, title, dueAt: due.toISOString(), url: x.url ?? e.url, courseId: x.courseId ?? course?.id ?? null, updatedAt: ts } : x));
          s.assignmentsUpdated++;
        }
      } else if (due >= subDays(now, 14)) {
        const a: Assignment = {
          id: uid("asg"),
          courseId: course?.id ?? null,
          title,
          description: e.description,
          dueAt: due.toISOString(),
          type: guessType({ name: title, types: [] }),
          estimatedHours: null,
          priority: "medium",
          gradeWeight: null,
          status: "not_started",
          submission: "not_submitted",
          subtasks: [],
          completedAt: null,
          url: e.url,
          external: { source: "canvas", id: canvasId },
          isDemo: false,
          createdAt: ts,
          updatedAt: ts,
        };
        assignments.push(a);
        s.assignmentsCreated++;
      }
      continue;
    }

    const prev = data.events.find((x) => x.source === "canvas" && x.externalId === e.uid);
    const end = e.end && e.end > e.start ? e.end : new Date(e.start.getTime() + (e.allDay ? 864e5 - 60_000 : 36e5));
    feedEvents.push({
      id: prev?.id ?? uid("evt"),
      title,
      type: prev?.type ?? eventType(title),
      courseId: course?.id ?? prev?.courseId ?? null,
      start: e.start.toISOString(),
      end: e.allDay ? new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate(), 23, 59).toISOString() : end.toISOString(),
      allDay: e.allDay,
      location: e.location,
      description: e.description,
      recurrence: null,
      exceptions: [],
      reminderMinutes: prev?.reminderMinutes ?? 30,
      source: "canvas",
      externalId: e.uid,
      isDemo: false,
      createdAt: prev?.createdAt ?? ts,
      updatedAt: ts,
    });
  }

  // The feed owns its events: replace previous Canvas events with the current set.
  const oldCanvas = data.events.filter((x) => x.source === "canvas");
  s.eventsRemoved = oldCanvas.filter((x) => !feedEvents.some((f) => f.id === x.id)).length;
  s.eventsSynced = feedEvents.length;
  s.unmatchedCourses = [...unmatched].sort();

  return {
    data: {
      ...data,
      assignments,
      events: [...data.events.filter((x) => x.source !== "canvas"), ...feedEvents],
      settings: { ...data.settings, canvas: { ...data.settings.canvas, lastFeedSync: ts } },
    },
    summary: s,
  };
}

/** Basic check that a URL looks like a Canvas calendar feed. */
export function isCanvasFeedUrl(url: string): boolean {
  try {
    const u = new URL(url.trim().replace(/^webcal:/i, "https:"));
    return u.protocol === "https:" && /\/feeds\/calendars\/[^/]+\.ics$/i.test(u.pathname);
  } catch {
    return false;
  }
}
