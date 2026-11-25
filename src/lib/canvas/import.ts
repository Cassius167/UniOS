/**
 * Merges a Canvas export (from the bookmarklet) into UniOS data.
 *
 * Pure functions, covered by import.test.ts. Re-importing is safe: records
 * are matched by their Canvas id (`external`), so nothing is duplicated and
 * your own edits to status, priority and subtasks are kept.
 */
import { format, subDays } from "date-fns";
import type { AppData, Assessment, Assignment, AssignmentType, Course, CourseTone, DropRule } from "../types";
import { uid } from "../ids";

/* ───────── Export file shape ───────── */

export interface CanvasAssignmentExport {
  id: string;
  name: string;
  due: string | null;
  points: number;
  url: string | null;
  description: string;
  types: string[];
  omit: boolean;
  published: boolean;
  score: number | null;
  graded: boolean;
  excused: boolean;
  missing: boolean;
  submitted: boolean;
}

export interface CanvasGroupExport {
  id: string;
  name: string;
  weight: number;
  dropLowest: number;
  assignments: CanvasAssignmentExport[];
}

export interface CanvasCourseExport {
  id: string;
  name: string;
  code: string;
  term: string | null;
  start: string | null;
  end: string | null;
  weighted: boolean;
  url: string;
  groups: CanvasGroupExport[];
}

export interface CanvasExport {
  source: "canvas-export";
  version: number;
  host: string;
  exportedAt: string;
  courses: CanvasCourseExport[];
}

export function parseCanvasExport(raw: unknown): CanvasExport {
  const x = raw as Partial<CanvasExport>;
  if (!x || x.source !== "canvas-export" || !Array.isArray(x.courses)) throw new Error("This isn’t a Canvas export from the UniOS bookmark.");
  if ((x.version ?? 0) > 1) throw new Error("This export was made by a newer version of the bookmark. Update UniOS.");
  return x as CanvasExport;
}

/* ───────── Helpers ───────── */

/** "APSC 171 101 2026W1" → "APSC 171"; falls back to the raw code. */
export function shortCode(code: string, name = ""): string {
  const m = /^\s*([A-Za-z]{2,5})[\s_-]*(\d{3})(?![0-9])/.exec(code) ?? /\b([A-Z]{2,5})[\s_-]*(\d{3})(?![0-9])/.exec(name);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : (code || name).trim().slice(0, 24);
}
const norm = (s: string) => s.replace(/[\s_-]+/g, "").toUpperCase();

export function guessType(a: Pick<CanvasAssignmentExport, "name" | "types">): AssignmentType {
  const n = a.name.toLowerCase();
  if (a.types.includes("online_quiz") || /\bquiz/.test(n)) return "quiz";
  if (/\b(final exam|midterm|exam|test)\b/.test(n)) return "exam";
  if (/\blab\b|laborator/.test(n)) return "lab";
  if (/presentation|pitch|poster/.test(n)) return "presentation";
  if (/report/.test(n)) return "report";
  if (/essay|memo|reflection|paper/.test(n)) return "essay";
  if (/project|design/.test(n)) return "project";
  if (/homework|problem set|\bps\s?\d|assignment|worksheet/.test(n)) return "homework";
  return "other";
}

const TONE_CYCLE: CourseTone[] = ["sage", "navy", "terra", "ochre", "slate", "moss", "clay", "stone"];

interface Counted {
  a: CanvasAssignmentExport;
  group: CanvasGroupExport;
  weight: number;
}

/** Converts Canvas groups/points into UniOS course-percentage weights. */
export function courseWeights(c: CanvasCourseExport): Counted[] {
  const counts = (a: CanvasAssignmentExport) => a.published && !a.omit && a.points > 0;
  const out: Counted[] = [];
  if (c.weighted) {
    for (const g of c.groups) {
      const items = g.assignments.filter(counts);
      const total = items.reduce((s, a) => s + a.points, 0);
      if (!total || !g.weight) continue;
      for (const a of items) out.push({ a, group: g, weight: (g.weight * a.points) / total });
    }
  } else {
    const items = c.groups.flatMap((g) => g.assignments.filter(counts).map((a) => ({ a, group: g })));
    const total = items.reduce((s, x) => s + x.a.points, 0);
    if (total) for (const x of items) out.push({ ...x, weight: (100 * x.a.points) / total });
  }
  return out;
}

/* ───────── Plan (preview) ───────── */

export interface CoursePlan {
  canvasId: string;
  code: string;
  name: string;
  term: string | null;
  matchId: string | null;
  matchLabel: string | null;
  assessments: number;
  graded: number;
  tasks: number;
  manualAssessments: number;
}

export function planCanvasImport(data: AppData, exp: CanvasExport, now = new Date()): CoursePlan[] {
  return exp.courses.map((c) => {
    const code = shortCode(c.code, c.name);
    const match = findCourse(data.courses, c, code);
    const weights = courseWeights(c);
    return {
      canvasId: c.id,
      code,
      name: c.name,
      term: c.term,
      matchId: match?.id ?? null,
      matchLabel: match ? `${match.code} · ${match.name}` : null,
      assessments: weights.length,
      graded: weights.filter((w) => w.a.graded && w.a.score !== null).length,
      tasks: c.groups.flatMap((g) => g.assignments).filter((a) => taskEligible(a, now)).length,
      manualAssessments: match ? data.assessments.filter((x) => x.courseId === match.id && x.external?.source !== "canvas").length : 0,
    };
  });
}

function findCourse(courses: Course[], c: CanvasCourseExport, code: string): Course | undefined {
  return courses.find((x) => x.external?.source === "canvas" && x.external.id === c.id) ?? courses.find((x) => !x.external && norm(x.code) === norm(code));
}

/** Tasks are created for dated assignments, skipping long-past ones that were never submitted. */
export function taskEligible(a: CanvasAssignmentExport, now: Date): boolean {
  if (!a.due || !a.published) return false;
  if (a.submitted || a.graded || a.excused) return true;
  return new Date(a.due) >= subDays(now, 14);
}

/* ───────── Apply ───────── */

export interface ImportOptions {
  courseIds: Set<string>; // Canvas course ids to import
  replaceManual: boolean; // remove non-Canvas assessments in courses that receive Canvas grades
  semesterId: string | null;
}

export interface ImportSummary {
  coursesCreated: number;
  coursesLinked: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  assessmentsCreated: number;
  assessmentsUpdated: number;
  manualRemoved: number;
}

export function applyCanvasImport(data: AppData, exp: CanvasExport, opts: ImportOptions, now = new Date()): { data: AppData; summary: ImportSummary } {
  const ts = now.toISOString();
  const s: ImportSummary = { coursesCreated: 0, coursesLinked: 0, assignmentsCreated: 0, assignmentsUpdated: 0, assessmentsCreated: 0, assessmentsUpdated: 0, manualRemoved: 0 };
  let courses = [...data.courses];
  let assessments = [...data.assessments];
  let assignments = [...data.assignments];

  for (const c of exp.courses) {
    if (!opts.courseIds.has(c.id)) continue;
    const code = shortCode(c.code, c.name);
    const groupsWithDrops: DropRule[] = c.groups.filter((g) => g.dropLowest > 0).map((g) => ({ category: g.name, dropLowest: g.dropLowest }));

    // Course
    let course = findCourse(courses, c, code);
    if (course) {
      const linked: Course = {
        ...course,
        external: { source: "canvas", id: c.id },
        website: course.website || c.url,
        dropRules: mergeDropRules(course.dropRules, groupsWithDrops),
        updatedAt: ts,
      };
      if (!course.external) s.coursesLinked++;
      courses = courses.map((x) => (x.id === course!.id ? linked : x));
      course = linked;
    } else {
      course = {
        id: uid("crs"),
        code,
        name: c.name.replace(new RegExp(`^${code}\\s*[-:·]?\\s*`, "i"), "").trim() || c.name,
        instructor: "",
        semesterId: opts.semesterId,
        description: c.term ? `Imported from Canvas (${c.term}).` : "Imported from Canvas.",
        officeHours: "",
        website: c.url,
        tone: TONE_CYCLE[courses.length % TONE_CYCLE.length],
        credits: 3,
        targetGrade: null,
        dropRules: groupsWithDrops,
        archived: false,
        external: { source: "canvas", id: c.id },
        isDemo: false,
        createdAt: ts,
        updatedAt: ts,
      };
      courses.push(course);
      s.coursesCreated++;
    }
    const courseId = course.id;

    // Grades
    const weights = courseWeights(c);
    if (weights.length && opts.replaceManual) {
      const before = assessments.length;
      assessments = assessments.filter((x) => !(x.courseId === courseId && x.external?.source !== "canvas"));
      s.manualRemoved += before - assessments.length;
    }
    for (const { a, group, weight } of weights) {
      const fields: Omit<Assessment, "id" | "createdAt" | "isDemo"> = {
        courseId,
        name: a.name,
        category: group.name,
        weight,
        // Ungraded stays null (never zero). Canvas only reports a score once it's graded.
        score: !a.excused && a.graded && a.score !== null ? a.score : null,
        maxScore: a.points,
        date: a.due ? format(new Date(a.due), "yyyy-MM-dd") : null,
        isBonus: false,
        excused: a.excused,
        external: { source: "canvas", id: a.id },
        updatedAt: ts,
      };
      const existing = assessments.find((x) => x.external?.source === "canvas" && x.external.id === a.id);
      if (existing) {
        assessments = assessments.map((x) => (x.id === existing.id ? { ...x, ...fields } : x));
        s.assessmentsUpdated++;
      } else {
        assessments.push({ ...fields, id: uid("asm"), isDemo: false, createdAt: ts });
        s.assessmentsCreated++;
      }
    }

    // Tasks
    const weightById = new Map(weights.map((w) => [w.a.id, w.weight]));
    for (const g of c.groups) {
      for (const a of g.assignments) {
        const existing = assignments.find((x) => x.external?.source === "canvas" && x.external.id === a.id);
        if (!existing && !taskEligible(a, now)) continue;
        if (!a.due) continue;
        const submission = a.graded && a.score !== null ? "graded" : a.submitted ? "submitted" : "not_submitted";
        const done = a.submitted || a.excused || (a.graded && a.score !== null);
        const w = weightById.get(a.id);
        if (existing) {
          assignments = assignments.map((x) =>
            x.id === existing.id
              ? {
                  ...x,
                  title: a.name,
                  dueAt: new Date(a.due!).toISOString(),
                  description: x.description || a.description,
                  url: a.url,
                  courseId,
                  gradeWeight: w !== undefined ? Math.round(w * 100) / 100 : x.gradeWeight,
                  submission: submission === "not_submitted" ? x.submission : submission,
                  // Never un-complete something the student finished.
                  status: done ? "completed" : x.status,
                  completedAt: done ? (x.completedAt ?? ts) : x.completedAt,
                  updatedAt: ts,
                }
              : x,
          );
          s.assignmentsUpdated++;
        } else {
          const t: Assignment = {
            id: uid("asg"),
            courseId,
            title: a.name,
            description: a.description,
            dueAt: new Date(a.due).toISOString(),
            type: guessType(a),
            estimatedHours: null,
            priority: "medium",
            gradeWeight: w !== undefined ? Math.round(w * 100) / 100 : null,
            status: done ? "completed" : "not_started",
            submission,
            subtasks: [],
            completedAt: done ? ts : null,
            url: a.url,
            external: { source: "canvas", id: a.id },
            isDemo: false,
            createdAt: ts,
            updatedAt: ts,
          };
          assignments.push(t);
          s.assignmentsCreated++;
        }
      }
    }
  }

  const settings = { ...data.settings, canvas: { ...data.settings.canvas, lastImport: ts } };
  return { data: { ...data, settings, courses, assessments, assignments }, summary: s };
}

function mergeDropRules(existing: DropRule[], incoming: DropRule[]): DropRule[] {
  const out = [...existing];
  for (const r of incoming) if (!out.some((x) => x.category.toLowerCase() === r.category.toLowerCase())) out.push(r);
  return out;
}
