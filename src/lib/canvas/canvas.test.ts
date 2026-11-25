import { describe, expect, it } from "vitest";
import { emptyData } from "../data/defaults";
import { summarize } from "../grades/engine";
import { applyCanvasImport, courseWeights, parseCanvasExport, planCanvasImport, shortCode, type CanvasExport } from "./import";
import { isCanvasFeedUrl, mergeFeed, parseIcs, splitSummary } from "./feed";
import type { AppData } from "../types";

const now = new Date("2026-11-24T20:00:00Z");
const asg = (p: Partial<CanvasExport["courses"][0]["groups"][0]["assignments"][0]> & { id: string; name: string }) => ({
  due: "2026-11-28T07:59:00Z",
  points: 10,
  url: `https://canvas.ubc.ca/courses/1/assignments/${p.id}`,
  description: "",
  types: ["online_upload"],
  omit: false,
  published: true,
  score: null,
  graded: false,
  excused: false,
  missing: false,
  submitted: false,
  ...p,
});

const exportFile = (): CanvasExport => ({
  source: "canvas-export",
  version: 1,
  host: "canvas.ubc.ca",
  exportedAt: now.toISOString(),
  courses: [
    {
      id: "101",
      name: "APSC 171 101 2026W1 Engineering Calculus I",
      code: "APSC 171 101 2026W1",
      term: "2026W1",
      start: null,
      end: null,
      weighted: true,
      url: "https://canvas.ubc.ca/courses/101",
      groups: [
        {
          id: "g1",
          name: "Quizzes",
          weight: 20,
          dropLowest: 1,
          assignments: [
            asg({ id: "1", name: "Quiz 1", points: 10, score: 8, graded: true, submitted: true, due: "2026-10-01T07:00:00Z" }),
            asg({ id: "2", name: "Quiz 2", points: 10, score: 6, graded: true, submitted: true, due: "2026-10-08T07:00:00Z" }),
            asg({ id: "3", name: "Quiz 3", points: 20 }),
          ],
        },
        {
          id: "g2",
          name: "Final",
          weight: 80,
          dropLowest: 0,
          assignments: [asg({ id: "4", name: "Final Exam", points: 100, due: "2026-12-12T17:00:00Z" }), asg({ id: "5", name: "Practice (not counted)", points: 0 })],
        },
      ],
    },
    {
      id: "202",
      name: "Orientation",
      code: "Orientation",
      term: null,
      start: null,
      end: null,
      weighted: false,
      url: "https://canvas.ubc.ca/courses/202",
      groups: [],
    },
  ],
});

describe("Canvas export import", () => {
  it("parses course codes", () => {
    expect(shortCode("APSC 171 101 2026W1")).toBe("APSC 171");
    expect(shortCode("CHEM_121_L2A")).toBe("CHEM 121");
    expect(shortCode("Orientation")).toBe("Orientation");
  });

  it("rejects files that are not exports", () => {
    expect(() => parseCanvasExport({ hello: 1 })).toThrow();
  });

  it("converts weighted groups into course weights", () => {
    const w = courseWeights(exportFile().courses[0]);
    const byId = Object.fromEntries(w.map((x) => [x.a.id, x.weight]));
    expect(byId["1"]).toBeCloseTo(5, 10); // 20% × 10/40
    expect(byId["3"]).toBeCloseTo(10, 10);
    expect(byId["4"]).toBeCloseTo(80, 10);
    expect(byId["5"]).toBeUndefined(); // 0-point items don't count
    expect(w.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(100, 10);
  });

  it("matches an existing course by code and previews counts", () => {
    const data = emptyData();
    data.courses.push({ id: "mine", code: "APSC 171", name: "Calc", instructor: "", semesterId: null, description: "", officeHours: "", website: "", tone: "sage", credits: 3, targetGrade: null, dropRules: [], archived: false, isDemo: false, createdAt: "", updatedAt: "" });
    const plan = planCanvasImport(data, exportFile(), now);
    expect(plan[0].matchId).toBe("mine");
    expect(plan[0].assessments).toBe(4);
    expect(plan[0].graded).toBe(2);
    expect(plan[1].matchId).toBeNull();
  });

  it("imports grades without turning ungraded work into zeros, and re-imports without duplicates", () => {
    const opts = { courseIds: new Set(["101"]), replaceManual: true, semesterId: null };
    const first = applyCanvasImport(emptyData(), exportFile(), opts, now);
    expect(first.summary.coursesCreated).toBe(1);
    const course = first.data.courses[0];
    expect(course.code).toBe("APSC 171");
    expect(course.dropRules).toEqual([{ category: "Quizzes", dropLowest: 1 }]);
    const items = first.data.assessments.filter((a) => a.courseId === course.id);
    expect(items).toHaveLength(4);
    expect(items.find((a) => a.name === "Final Exam")!.score).toBeNull();
    const s = summarize(items, course.dropRules);
    // Quiz 1 kept (80%), quiz 2 dropped; average on completed work = 80%
    expect(s.currentAverage).toBeCloseTo(80, 10);

    // Tasks: past-due graded quizzes are completed; upcoming are open
    expect(first.data.assignments.find((a) => a.title === "Quiz 1")!.status).toBe("completed");
    expect(first.data.assignments.find((a) => a.title === "Final Exam")!.status).toBe("not_started");

    // Student edits, then Canvas grades Quiz 3 and moves the final.
    const edited: AppData = { ...first.data, assignments: first.data.assignments.map((a) => (a.title === "Final Exam" ? { ...a, priority: "urgent" } : a)) };
    const exp2 = exportFile();
    exp2.courses[0].groups[0].assignments[2] = { ...exp2.courses[0].groups[0].assignments[2], score: 18, graded: true, submitted: true };
    exp2.courses[0].groups[1].assignments[0].due = "2026-12-13T17:00:00Z";
    const second = applyCanvasImport(edited, exp2, opts, now);
    expect(second.summary.coursesCreated).toBe(0);
    expect(second.summary.assessmentsCreated).toBe(0);
    expect(second.data.assessments).toHaveLength(4);
    expect(second.data.assessments.find((a) => a.name === "Quiz 3")!.score).toBe(18);
    const fin = second.data.assignments.find((a) => a.title === "Final Exam")!;
    expect(fin.priority).toBe("urgent");
    expect(fin.dueAt).toBe("2026-12-13T17:00:00.000Z");
    expect(second.data.assignments.filter((a) => a.title === "Final Exam")).toHaveLength(1);
  });

  it("replaces manually entered structure only when asked", () => {
    const data = emptyData();
    data.courses.push({ id: "mine", code: "APSC 171", name: "Calc", instructor: "", semesterId: null, description: "", officeHours: "", website: "", tone: "sage", credits: 3, targetGrade: null, dropRules: [], archived: false, isDemo: false, createdAt: "", updatedAt: "" });
    data.assessments.push({ id: "m1", courseId: "mine", name: "Midterm", category: "", weight: 30, score: 70, maxScore: 100, date: null, isBonus: false, excused: false, isDemo: false, createdAt: "", updatedAt: "" });
    const keep = applyCanvasImport(data, exportFile(), { courseIds: new Set(["101"]), replaceManual: false, semesterId: null }, now);
    expect(keep.data.assessments.some((a) => a.id === "m1")).toBe(true);
    const replace = applyCanvasImport(data, exportFile(), { courseIds: new Set(["101"]), replaceManual: true, semesterId: null }, now);
    expect(replace.data.assessments.some((a) => a.id === "m1")).toBe(false);
    expect(replace.summary.manualRemoved).toBe(1);
    expect(replace.summary.coursesLinked).toBe(1);
  });
});

const ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "DTSTART:20261128T075900Z",
  "DTEND:20261128T075900Z",
  "SUMMARY:Lab 8 report: Titration [CHEM 121 101 2026W1]",
  "UID:event-assignment-555",
  "URL:https://canvas.ubc.ca/courses/9/assignments/555",
  "DESCRIPTION:Submit the PDF\\, please.\\nThanks",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261203",
  "SUMMARY:Midterm review session [CHEM 121 101 2026W1]",
  "UID:event-calendar-event-77",
  "LOCATION:SCI 3",
  " 33",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("Canvas calendar feed", () => {
  it("validates feed URLs", () => {
    expect(isCanvasFeedUrl("https://canvas.ubc.ca/feeds/calendars/user_abc123.ics")).toBe(true);
    expect(isCanvasFeedUrl("webcal://canvas.ubc.ca/feeds/calendars/user_abc123.ics")).toBe(true);
    expect(isCanvasFeedUrl("http://localhost/feeds/calendars/x.ics")).toBe(false);
    expect(isCanvasFeedUrl("https://evil.example.com/other.ics")).toBe(false);
  });

  it("parses events with escapes, folded lines and all-day dates", () => {
    const ev = parseIcs(ICS);
    expect(ev).toHaveLength(2);
    expect(ev[0].description).toBe("Submit the PDF, please.\nThanks");
    expect(ev[0].start.toISOString()).toBe("2026-11-28T07:59:00.000Z");
    expect(ev[1].allDay).toBe(true);
    expect(ev[1].location).toBe("SCI 333");
    expect(splitSummary(ev[0].summary)).toEqual({ title: "Lab 8 report: Titration", code: "CHEM 121" });
  });

  it("creates assignments and events, then updates without duplicating", () => {
    const data = emptyData();
    data.courses.push({ id: "chem", code: "CHEM 121", name: "Chem", instructor: "", semesterId: null, description: "", officeHours: "", website: "", tone: "sage", credits: 3, targetGrade: null, dropRules: [], archived: false, isDemo: false, createdAt: "", updatedAt: "" });
    const first = mergeFeed(data, parseIcs(ICS), now);
    expect(first.summary.assignmentsCreated).toBe(1);
    expect(first.summary.eventsSynced).toBe(1);
    const a = first.data.assignments[0];
    expect(a.courseId).toBe("chem");
    expect(a.external).toEqual({ source: "canvas", id: "555" });
    const second = mergeFeed(first.data, parseIcs(ICS.replace("20261128T075900Z", "20261129T075900Z")), now);
    expect(second.data.assignments).toHaveLength(1);
    expect(second.summary.assignmentsUpdated).toBe(1);
    expect(second.data.events).toHaveLength(1);
    expect(second.data.events[0].id).toBe(first.data.events[0].id);
  });
});
