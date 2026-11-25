/**
 * Assignment intelligence: a transparent, rule-based attention score.
 *
 * This is a *recommendation*, not a prediction. Each factor is reported
 * separately so the UI can say exactly why something ranks highly.
 */
import type { Assignment, Priority } from "../types";

export interface AttentionFactor {
  label: string;
  /** Contribution to the score (0–100 scale overall). */
  points: number;
}

export interface AttentionScore {
  assignmentId: string;
  score: number; // 0–100
  factors: AttentionFactor[];
  hoursUntilDue: number;
  remainingHours: number | null;
  overdue: boolean;
}

const PRIORITY_POINTS: Record<Priority, number> = { low: 2, medium: 8, high: 15, urgent: 22 };

export function completion(a: Pick<Assignment, "subtasks" | "status">): number {
  if (a.status === "completed") return 100;
  if (a.subtasks.length === 0) return a.status === "in_progress" ? 25 : 0;
  return (a.subtasks.filter((s) => s.done).length / a.subtasks.length) * 100;
}

/** Hours of work estimated to remain, scaling the estimate by subtask progress. */
export function remainingWork(a: Assignment): number | null {
  if (a.estimatedHours === null) return null;
  return a.estimatedHours * (1 - completion(a) / 100);
}

export function attentionScore(a: Assignment, now: Date = new Date()): AttentionScore {
  const hoursUntilDue = (new Date(a.dueAt).getTime() - now.getTime()) / 36e5;
  const remainingHours = remainingWork(a);
  const overdue = hoursUntilDue < 0 && a.status !== "completed";
  const factors: AttentionFactor[] = [];

  if (a.status === "completed") {
    return { assignmentId: a.id, score: 0, factors, hoursUntilDue, remainingHours, overdue: false };
  }

  // 1. Deadline proximity: up to 40 points, decaying over ~2 weeks.
  const proximity = overdue ? 40 : 40 * Math.exp(-Math.max(0, hoursUntilDue) / 96);
  factors.push({ label: overdue ? "Past due" : "Deadline proximity", points: proximity });

  // 2. Stated priority: up to 22 points.
  factors.push({ label: `${a.priority[0].toUpperCase()}${a.priority.slice(1)} priority`, points: PRIORITY_POINTS[a.priority] });

  // 3. Workload pressure: remaining work relative to time left, up to 20 points.
  if (remainingHours !== null && remainingHours > 0) {
    const ratio = hoursUntilDue <= 0 ? 1 : Math.min(1, remainingHours / Math.max(1, hoursUntilDue / 3));
    factors.push({ label: `~${remainingHours.toFixed(1)}h of work left`, points: 20 * ratio });
  }

  // 4. Incomplete subtasks: up to 10 points.
  const open = a.subtasks.filter((s) => !s.done).length;
  if (open > 0) factors.push({ label: `${open} open subtask${open === 1 ? "" : "s"}`, points: Math.min(10, open * 1.5) });

  // 5. Grade weight: up to 8 points.
  if (a.gradeWeight) factors.push({ label: `Worth ${a.gradeWeight}% of course`, points: Math.min(8, a.gradeWeight / 4) });

  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  return { assignmentId: a.id, score, factors: factors.sort((x, y) => y.points - x.points), hoursUntilDue, remainingHours, overdue };
}

export function rankAssignments(list: Assignment[], now: Date = new Date()): AttentionScore[] {
  return list
    .filter((a) => a.status !== "completed")
    .map((a) => attentionScore(a, now))
    .sort((a, b) => b.score - a.score);
}

export function attentionLabel(score: number): "Needs attention now" | "Plan soon" | "On track" {
  if (score >= 60) return "Needs attention now";
  if (score >= 35) return "Plan soon";
  return "On track";
}
