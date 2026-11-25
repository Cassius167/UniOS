/**
 * Derived statistics. Every number here is computed from stored records
 * (sessions, assignments, assessments) — nothing is estimated or invented.
 */
import { addDays, eachDayOfInterval, endOfDay, format, isWithinInterval, startOfDay, startOfWeek, subDays } from "date-fns";
import type { AppData } from "./types";
import { summarize } from "./grades/engine";

export interface Range {
  start: Date;
  end: Date;
}

export function weekRange(now: Date, weekStartsOn: 0 | 1): Range {
  const start = startOfWeek(now, { weekStartsOn });
  return { start, end: endOfDay(addDays(start, 6)) };
}

export function lastNDays(now: Date, n: number): Range {
  return { start: startOfDay(subDays(now, n - 1)), end: endOfDay(now) };
}

const inRange = (iso: string, r: Range) => isWithinInterval(new Date(iso), r);

export function productivity(data: AppData, r: Range) {
  const sessions = data.sessions.filter((s) => inRange(s.startedAt, r));
  const minutes = sessions.reduce((s, x) => s + x.actualMinutes, 0);
  const completed = data.assignments.filter((a) => a.completedAt && inRange(a.completedAt, r));
  const due = data.assignments.filter((a) => inRange(a.dueAt, r));
  const dueDone = due.filter((a) => a.status === "completed");
  const distractions = sessions.reduce((s, x) => s + x.distractions.length, 0);
  const rated = sessions.filter((s) => s.rating !== null);
  return {
    sessions,
    sessionCount: sessions.length,
    minutes,
    avgSessionMinutes: sessions.length ? minutes / sessions.length : null,
    completedCount: completed.length,
    dueCount: due.length,
    dueCompletedCount: dueDone.length,
    /** Share of assignments due in the range that are completed. null if none were due. */
    completionRate: due.length ? (dueDone.length / due.length) * 100 : null,
    distractions,
    avgRating: rated.length ? rated.reduce((s, x) => s + (x.rating ?? 0), 0) / rated.length : null,
  };
}

export function minutesByDay(data: AppData, r: Range) {
  return eachDayOfInterval(r).map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const minutes = data.sessions.filter((s) => format(new Date(s.startedAt), "yyyy-MM-dd") === key).reduce((s, x) => s + x.actualMinutes, 0);
    return { key, label: format(d, "EEE"), short: format(d, "d"), date: d, minutes };
  });
}

export function minutesByCourse(data: AppData, r: Range) {
  const m = new Map<string, number>();
  for (const s of data.sessions) {
    if (!inRange(s.startedAt, r)) continue;
    const k = s.courseId ?? "none";
    m.set(k, (m.get(k) ?? 0) + s.actualMinutes);
  }
  return [...m.entries()]
    .map(([courseId, minutes]) => {
      const c = data.courses.find((x) => x.id === courseId);
      return { courseId, label: c?.code ?? "No course", tone: c?.tone ?? "stone", minutes };
    })
    .sort((a, b) => b.minutes - a.minutes);
}

/** Weeks (of the last `weeks`) with at least one study session, as a share. */
export function consistency(data: AppData, now: Date, weeks: number, weekStartsOn: 0 | 1) {
  const out: { label: string; minutes: number; days: number }[] = [];
  let start = startOfWeek(now, { weekStartsOn });
  for (let i = 0; i < weeks; i++) {
    const r = { start, end: endOfDay(addDays(start, 6)) };
    const ss = data.sessions.filter((s) => inRange(s.startedAt, r));
    const days = new Set(ss.map((s) => format(new Date(s.startedAt), "yyyy-MM-dd"))).size;
    out.unshift({ label: format(start, "d MMM"), minutes: ss.reduce((s, x) => s + x.actualMinutes, 0), days });
    start = subDays(start, 7);
  }
  return out;
}

/** Running average on completed work over time for one course (by assessment date). */
export function gradeProgression(data: AppData, courseId: string) {
  const course = data.courses.find((c) => c.id === courseId);
  const items = data.assessments.filter((a) => a.courseId === courseId && a.score !== null && a.date && !a.excused).sort((a, b) => a.date!.localeCompare(b.date!));
  const all = data.assessments.filter((a) => a.courseId === courseId);
  const points: { date: string; average: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const graded = new Set(items.slice(0, i + 1).map((x) => x.id));
    const snapshot = all.map((a) => (graded.has(a.id) ? a : { ...a, score: null }));
    const s = summarize(snapshot, course?.dropRules ?? []);
    if (s.currentAverage !== null) points.push({ date: items[i].date!, average: s.currentAverage });
  }
  return points;
}

/** Hours of estimated remaining assignment work due per upcoming week. */
export function upcomingWorkload(data: AppData, now: Date, weeks: number, weekStartsOn: 0 | 1) {
  const out: { label: string; count: number; hours: number }[] = [];
  let start = startOfWeek(now, { weekStartsOn });
  for (let i = 0; i < weeks; i++) {
    const r = { start, end: endOfDay(addDays(start, 6)) };
    const due = data.assignments.filter((a) => a.status !== "completed" && inRange(a.dueAt, r));
    out.push({
      label: i === 0 ? "This week" : format(start, "d MMM"),
      count: due.length,
      hours: due.reduce((s, a) => s + (a.estimatedHours ?? 0) * (1 - (a.subtasks.length ? a.subtasks.filter((x) => x.done).length / a.subtasks.length : 0)), 0),
    });
    start = addDays(start, 7);
  }
  return out;
}
