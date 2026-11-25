/**
 * UniOS grade calculation engine.
 *
 * Pure functions only: no React, no storage. Everything here is covered by
 * engine.test.ts. Terminology used throughout:
 *
 *  - weight         The share of the final course grade an assessment is worth (percent).
 *  - points         Course percentage points. An assessment worth 15% that scored 80%
 *                   contributes 12 points. A full course is 100 points.
 *  - gradedWeight   Weight of assessments that have a score (or were explicitly marked zero).
 *  - currentAverage Points earned ÷ graded weight. "How am I doing on what's been marked?"
 *  - earnedPoints   Points banked so far out of the whole course. "What's locked in?"
 *  - openWeight     Weight still to be decided: ungraded assessments + any weight the
 *                   student hasn't entered into the structure yet.
 *
 * Rules (from the product spec):
 *  - An ungraded assessment (score === null) is never treated as zero.
 *  - Bonus assessments add points without adding to the denominator.
 *  - Drop-lowest is only applied when a DropRule is configured for that category.
 *  - Excused assessments are removed from the structure entirely.
 *  - No rounding happens here; round only for display (see `round`).
 */

import type { Assessment, DropRule, GradeBand } from "../types";

/** Tolerance for floating point comparisons (e.g. "is required ≤ 0?"). */
export const EPS = 1e-9;

export type GradeItemInput = Pick<
  Assessment,
  "id" | "name" | "category" | "weight" | "score" | "maxScore" | "isBonus" | "excused" | "date"
>;

export interface GradeItemResult {
  id: string;
  name: string;
  category: string;
  date: string | null;
  /** Weight as entered by the student. */
  weight: number;
  /** Weight after drop rules have redistributed a category's share. */
  effectiveWeight: number;
  isBonus: boolean;
  graded: boolean;
  dropped: boolean;
  /** Score as a percentage of the assessment's maximum, or null if ungraded. */
  percent: number | null;
  /** Course points this item contributes (0 if ungraded or dropped). */
  points: number;
}

export interface GradeSummary {
  items: GradeItemResult[];
  /** Sum of effective weights of non-bonus assessments in the structure. */
  structureWeight: number;
  /** Total the course is graded out of: 100, or the structure total if it exceeds 100. */
  basis: number;
  gradedWeight: number;
  remainingWeight: number;
  unallocatedWeight: number;
  openWeight: number;
  /** Points from regular (non-bonus) graded items. */
  regularPoints: number;
  bonusPoints: number;
  /** regularPoints + bonusPoints */
  earnedPoints: number;
  /** Course percentage locked in so far (earnedPoints as a percent of basis). */
  earnedPercent: number;
  /** Average on completed work, as a percent. null if nothing graded. */
  currentAverage: number | null;
  /** Final grade if every open assessment scores the current average. null if nothing graded. */
  projectedFinal: number | null;
  /** Final grade if every open assessment scores 0. */
  minPossible: number;
  /** Final grade if every open assessment scores 100. */
  maxPossible: number;
  /** Warnings the UI should surface (over-allocated weights, etc.). */
  warnings: string[];
}

export function toPercent(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return NaN;
  return (score / maxScore) * 100;
}

/** Round half away from zero, avoiding binary artefacts like 1.005 → 1.00. */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  const shifted = Math.abs(value) * factor;
  // Correct for representation error before rounding (e.g. 1.005 * 100 = 100.49999…)
  const corrected = Math.round(shifted + shifted * Number.EPSILON * 4);
  return (Math.sign(value) * corrected) / factor;
}

/**
 * Applies configured drop rules and returns each item's effective weight and
 * whether it was dropped.
 *
 * Model: a category with N items and a "drop lowest k" rule keeps N−k items,
 * which share the category's total weight equally. While the term is in
 * progress, only graded items can be dropped, and at least one graded item is
 * always kept, so d = min(k, graded − 1) items are dropped and each kept item
 * is worth W ÷ (N − d). Once every item is graded this is exactly W ÷ (N − k),
 * and the category always sums to W along the way.
 */
function applyDropRules(
  items: GradeItemInput[],
  rules: DropRule[],
): Map<string, { effectiveWeight: number; dropped: boolean }> {
  const out = new Map<string, { effectiveWeight: number; dropped: boolean }>();
  for (const it of items) out.set(it.id, { effectiveWeight: it.weight, dropped: false });

  for (const rule of rules) {
    if (!rule.category || rule.dropLowest <= 0) continue;
    const group = items.filter(
      (it) => !it.isBonus && it.category.trim().toLowerCase() === rule.category.trim().toLowerCase(),
    );
    const n = group.length;
    if (n < 2) continue;
    const k = Math.min(Math.floor(rule.dropLowest), n - 1);
    const totalWeight = group.reduce((s, it) => s + it.weight, 0);
    const graded = group
      .filter((it) => it.score !== null)
      .map((it) => ({ it, pct: toPercent(it.score as number, it.maxScore) }))
      // lowest first; ties broken by id for determinism
      .sort((a, b) => a.pct - b.pct || a.it.id.localeCompare(b.it.id));
    const d = Math.min(k, Math.max(0, graded.length - 1));
    const droppedIds = new Set(graded.slice(0, d).map((g) => g.it.id));
    const share = totalWeight / (n - d);
    for (const it of group) {
      out.set(it.id, droppedIds.has(it.id) ? { effectiveWeight: 0, dropped: true } : { effectiveWeight: share, dropped: false });
    }
  }
  return out;
}

export function summarize(input: GradeItemInput[], dropRules: DropRule[] = []): GradeSummary {
  const warnings: string[] = [];
  const items = input.filter((it) => !it.excused);
  const drops = applyDropRules(items, dropRules);

  const results: GradeItemResult[] = items.map((it) => {
    const { effectiveWeight, dropped } = drops.get(it.id)!;
    const graded = it.score !== null && Number.isFinite(it.score);
    const percent = graded ? toPercent(it.score as number, it.maxScore) : null;
    const points = graded && !dropped && percent !== null && Number.isFinite(percent) ? (effectiveWeight * percent) / 100 : 0;
    return {
      id: it.id,
      name: it.name,
      category: it.category,
      date: it.date,
      weight: it.weight,
      effectiveWeight,
      isBonus: it.isBonus,
      graded,
      dropped,
      percent,
      points,
    };
  });

  const regular = results.filter((r) => !r.isBonus && !r.dropped);
  const structureWeight = sum(regular.map((r) => r.effectiveWeight));
  const gradedWeight = sum(regular.filter((r) => r.graded).map((r) => r.effectiveWeight));
  const remainingWeight = sum(regular.filter((r) => !r.graded).map((r) => r.effectiveWeight));
  const regularPoints = sum(regular.filter((r) => r.graded).map((r) => r.points));
  const bonusPoints = sum(results.filter((r) => r.isBonus && r.graded).map((r) => r.points));
  const earnedPoints = regularPoints + bonusPoints;

  const basis = Math.max(100, structureWeight);
  if (structureWeight > 100 + EPS) {
    warnings.push(
      `Assessment weights total ${round(structureWeight)}%. Grades are calculated out of ${round(structureWeight)} until this is corrected.`,
    );
  }
  const unallocatedWeight = Math.max(0, 100 - structureWeight);
  const openWeight = remainingWeight + unallocatedWeight;

  const currentAverage = gradedWeight > EPS ? (earnedPoints / gradedWeight) * 100 : null;
  const toCourse = (points: number) => (points / basis) * 100;

  return {
    items: results,
    structureWeight,
    basis,
    gradedWeight,
    remainingWeight,
    unallocatedWeight,
    openWeight,
    regularPoints,
    bonusPoints,
    earnedPoints,
    earnedPercent: toCourse(earnedPoints),
    currentAverage,
    projectedFinal: currentAverage === null ? null : toCourse(earnedPoints + (openWeight * Math.min(currentAverage, 100)) / 100),
    minPossible: toCourse(earnedPoints),
    maxPossible: toCourse(earnedPoints + openWeight),
    warnings,
  };
}

/* ─────────────────────────── Targets ─────────────────────────── */

export type TargetStatus =
  /** Target can be reached with `required` % on the open work. */
  | "achievable"
  /** Target is already guaranteed even with zero on everything left. */
  | "secured"
  /** Even 100% on everything left falls short. */
  | "impossible"
  /** Nothing is left to grade; `finalGrade` is the outcome. */
  | "complete";

export interface TargetResult {
  target: number;
  status: TargetStatus;
  /** Average needed on the open weight, as a percent. Raw (may exceed 100 or be negative). */
  required: number | null;
  /** Best achievable result, for context on impossible targets. */
  maxPossible: number;
}

/** Average required across *all* open weight to finish with `target` %. */
export function requiredForTarget(summary: GradeSummary, target: number): TargetResult {
  const targetPoints = (target / 100) * summary.basis;
  const gap = targetPoints - summary.earnedPoints;
  if (summary.openWeight <= EPS) {
    return {
      target,
      status: gap <= EPS ? "secured" : "complete",
      required: null,
      maxPossible: summary.maxPossible,
    };
  }
  const required = (gap / summary.openWeight) * 100;
  return {
    target,
    status: required <= EPS ? "secured" : required > 100 + EPS ? "impossible" : "achievable",
    required,
    maxPossible: summary.maxPossible,
  };
}

/**
 * Grade needed on one specific ungraded assessment (typically the final exam)
 * to finish with `target` %, assuming every *other* open assessment — and any
 * unallocated weight — scores `othersAssumed` %.
 */
export function requiredOnAssessment(
  summary: GradeSummary,
  assessmentId: string,
  target: number,
  othersAssumed: number,
): TargetResult | null {
  const item = summary.items.find((r) => r.id === assessmentId);
  if (!item || item.graded || item.isBonus || item.dropped || item.effectiveWeight <= EPS) return null;
  const targetPoints = (target / 100) * summary.basis;
  const othersWeight = summary.openWeight - item.effectiveWeight;
  const othersPoints = (Math.max(0, othersWeight) * othersAssumed) / 100;
  const required = ((targetPoints - summary.earnedPoints - othersPoints) / item.effectiveWeight) * 100;
  const maxPossible = ((summary.earnedPoints + othersPoints + item.effectiveWeight) / summary.basis) * 100;
  return {
    target,
    status: required <= EPS ? "secured" : required > 100 + EPS ? "impossible" : "achievable",
    required,
    maxPossible,
  };
}

/* ─────────────────────────── Scenarios ─────────────────────────── */

/**
 * Returns a copy of the items with hypothetical percentages applied to
 * ungraded assessments. Entered grades are never overwritten.
 */
export function applyHypotheticals(
  items: GradeItemInput[],
  hypothetical: Record<string, number | undefined>,
): GradeItemInput[] {
  return items.map((it) => {
    const h = hypothetical[it.id];
    if (it.score !== null || h === undefined || !Number.isFinite(h)) return it;
    return { ...it, score: (h / 100) * it.maxScore };
  });
}

/**
 * Final course grade under a scenario. Ungraded assessments not covered by
 * `hypothetical` (and any unallocated weight) use `fallback` %.
 */
export function scenarioFinal(
  items: GradeItemInput[],
  dropRules: DropRule[],
  hypothetical: Record<string, number | undefined>,
  fallback: number,
): number {
  const filled: Record<string, number> = {};
  for (const it of items) {
    if (it.excused || it.score !== null) continue;
    if (it.isBonus) {
      // Bonus work only counts if the student explicitly hypothesises it.
      if (hypothetical[it.id] !== undefined) filled[it.id] = hypothetical[it.id]!;
      continue;
    }
    filled[it.id] = hypothetical[it.id] ?? fallback;
  }
  const s = summarize(applyHypotheticals(items, filled), dropRules);
  return ((s.earnedPoints + (s.unallocatedWeight * fallback) / 100) / s.basis) * 100;
}

/** Final grade as a function of a uniform score on all open work — for the outcome chart. */
export function outcomeCurve(
  items: GradeItemInput[],
  dropRules: DropRule[],
  step = 10,
): { score: number; final: number }[] {
  const out: { score: number; final: number }[] = [];
  for (let score = 0; score <= 100 + EPS; score += step) {
    out.push({ score, final: scenarioFinal(items, dropRules, {}, score) });
  }
  return out;
}

/* ─────────────────────────── Letter grades & explanations ─────────────────────────── */

export function bandFor(percent: number | null, scale: GradeBand[]): GradeBand | null {
  if (percent === null || !Number.isFinite(percent)) return null;
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  return sorted.find((b) => percent + EPS >= b.min) ?? null;
}

/** Plain-language steps describing how the current numbers were produced. */
export function explain(summary: GradeSummary): string[] {
  const lines: string[] = [];
  const f = (n: number) => round(n, 2).toFixed(2);
  for (const r of summary.items) {
    if (r.dropped) {
      lines.push(`${r.name}: ${f(r.percent ?? 0)}%, dropped by the "${r.category}" drop rule (worth 0 points).`);
    } else if (r.graded) {
      lines.push(
        `${r.name}${r.isBonus ? " (bonus)" : ""}: ${f(r.percent!)}% × ${f(r.effectiveWeight)}% weight = ${f(r.points)} points.`,
      );
    } else {
      lines.push(`${r.name}: not graded yet, ${f(r.effectiveWeight)}% weight still open (not counted as zero).`);
    }
  }
  lines.push(
    `Points earned: ${f(summary.earnedPoints)} out of ${f(summary.gradedWeight)} graded weight${summary.bonusPoints > 0 ? ` (includes ${f(summary.bonusPoints)} bonus points)` : ""}.`,
  );
  if (summary.currentAverage !== null) {
    lines.push(`Average on completed work = ${f(summary.earnedPoints)} ÷ ${f(summary.gradedWeight)} × 100 = ${f(summary.currentAverage)}%.`);
  }
  lines.push(`Course percentage earned so far = ${f(summary.earnedPoints)} ÷ ${f(summary.basis)} × 100 = ${f(summary.earnedPercent)}%.`);
  if (summary.unallocatedWeight > EPS) {
    lines.push(`${f(summary.unallocatedWeight)}% of the course has no assessments entered yet and is treated as open.`);
  }
  lines.push(`Open weight (still to be decided): ${f(summary.openWeight)}%.`);
  return lines;
}

function sum(values: number[]): number {
  // Kahan summation keeps long lists of fractional weights exact enough.
  let total = 0;
  let c = 0;
  for (const v of values) {
    const y = v - c;
    const t = total + y;
    c = t - total - y;
    total = t;
  }
  return total;
}
