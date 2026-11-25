import { describe, expect, it } from "vitest";
import { expandEvent } from "./recurrence";
import type { CalendarEvent } from "../types";

const base = (p: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e1",
  title: "Lecture",
  type: "lecture",
  courseId: null,
  start: new Date(2026, 8, 8, 9, 30).toISOString(), // Tue 8 Sep 2026 09:30 local
  end: new Date(2026, 8, 8, 11, 0).toISOString(),
  allDay: false,
  location: "",
  description: "",
  recurrence: null,
  exceptions: [],
  reminderMinutes: null,
  source: "local",
  externalId: null,
  isDemo: false,
  createdAt: "",
  updatedAt: "",
  ...p,
});

describe("expandEvent", () => {
  it("returns a single occurrence for one-off events in range", () => {
    const occ = expandEvent(base({}), new Date(2026, 8, 1), new Date(2026, 8, 30));
    expect(occ).toHaveLength(1);
    expect(occ[0].start.getHours()).toBe(9);
  });

  it("expands weekly events on chosen weekdays", () => {
    const e = base({ recurrence: { freq: "weekly", interval: 1, byWeekday: [2, 4], until: "2026-09-30" } });
    const occ = expandEvent(e, new Date(2026, 8, 1), new Date(2026, 9, 31));
    // Tue/Thu from 8 Sep to 30 Sep: 8,10,15,17,22,24,29 = 7
    expect(occ).toHaveLength(7);
    expect(occ.every((o) => o.start.getHours() === 9 && o.start.getMinutes() === 30)).toBe(true);
    expect(occ.every((o) => o.end.getTime() - o.start.getTime() === 90 * 60_000)).toBe(true);
  });

  it("respects intervals and exceptions", () => {
    const e = base({
      recurrence: { freq: "weekly", interval: 2, byWeekday: [2], until: null },
      exceptions: ["2026-09-22"],
    });
    const occ = expandEvent(e, new Date(2026, 8, 1), new Date(2026, 9, 10));
    // 8 Sep, (22 Sep skipped), 6 Oct
    expect(occ.map((o) => o.dateKey)).toEqual(["2026-09-08", "2026-10-06"]);
  });

  it("supports daily recurrence", () => {
    const e = base({ recurrence: { freq: "daily", interval: 1, byWeekday: [], until: "2026-09-10" } });
    expect(expandEvent(e, new Date(2026, 0, 1), new Date(2026, 11, 31))).toHaveLength(3);
  });
});
