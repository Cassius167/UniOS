import { describe, expect, it } from "vitest";
import { attentionScore, completion, rankAssignments } from "./priority";
import type { Assignment } from "../types";

const now = new Date("2026-11-24T12:00:00Z");
const a = (p: Partial<Assignment>): Assignment => ({
  id: p.id ?? "x",
  courseId: null,
  title: "T",
  description: "",
  dueAt: "2026-12-01T12:00:00Z",
  type: "homework",
  estimatedHours: null,
  priority: "medium",
  gradeWeight: null,
  status: "not_started",
  submission: "not_submitted",
  subtasks: [],
  completedAt: null,
  isDemo: false,
  createdAt: "",
  updatedAt: "",
  ...p,
});

describe("assignment intelligence", () => {
  it("computes completion from subtasks", () => {
    const sub = (done: boolean) => ({ id: String(Math.random()), title: "", done, dueDate: null, priority: "low" as const, estimatedMinutes: null });
    expect(completion(a({ subtasks: [sub(true), sub(false), sub(false), sub(true)] }))).toBe(50);
    expect(completion(a({ status: "completed" }))).toBe(100);
  });

  it("ranks nearer, heavier, higher-priority work first", () => {
    const ranked = rankAssignments(
      [
        a({ id: "far", dueAt: "2026-12-20T12:00:00Z" }),
        a({ id: "soon", dueAt: "2026-11-25T12:00:00Z", priority: "high", estimatedHours: 6 }),
        a({ id: "done", status: "completed" }),
      ],
      now,
    );
    expect(ranked.map((r) => r.assignmentId)).toEqual(["soon", "far"]);
  });

  it("flags overdue work and explains its factors", () => {
    const s = attentionScore(a({ dueAt: "2026-11-23T12:00:00Z" }), now);
    expect(s.overdue).toBe(true);
    expect(s.factors[0].label).toBe("Past due");
    expect(s.score).toBeLessThanOrEqual(100);
  });
});
