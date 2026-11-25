import { describe, expect, it } from "vitest";
import {
  bandFor,
  explain,
  outcomeCurve,
  requiredForTarget,
  requiredOnAssessment,
  round,
  scenarioFinal,
  summarize,
  type GradeItemInput,
} from "./engine";

let n = 0;
function item(p: Partial<GradeItemInput> & { weight: number }): GradeItemInput {
  n += 1;
  return {
    id: p.id ?? `a${n}`,
    name: p.name ?? `Item ${n}`,
    category: p.category ?? "",
    weight: p.weight,
    score: p.score ?? null,
    maxScore: p.maxScore ?? 100,
    isBonus: p.isBonus ?? false,
    excused: p.excused ?? false,
    date: p.date ?? null,
  };
}

/** The example structure from the spec. */
function specCourse(scores: { m1?: number | null; m2?: number | null; asg?: number | null; labs?: number | null; final?: number | null }) {
  return [
    item({ id: "m1", name: "Midterm 1", weight: 15, score: scores.m1 ?? null }),
    item({ id: "m2", name: "Midterm 2", weight: 20, score: scores.m2 ?? null }),
    item({ id: "asg", name: "Assignments", weight: 10, score: scores.asg ?? null }),
    item({ id: "labs", name: "Labs", weight: 15, score: scores.labs ?? null }),
    item({ id: "final", name: "Final Exam", weight: 40, score: scores.final ?? null }),
  ];
}

describe("summarize", () => {
  it("returns empty state with no grades", () => {
    const s = summarize(specCourse({}));
    expect(s.structureWeight).toBe(100);
    expect(s.gradedWeight).toBe(0);
    expect(s.currentAverage).toBeNull();
    expect(s.projectedFinal).toBeNull();
    expect(s.earnedPoints).toBe(0);
    expect(s.openWeight).toBe(100);
    expect(s.maxPossible).toBe(100);
  });

  it("never treats ungraded work as zero", () => {
    const s = summarize(specCourse({ m1: 80 }));
    // 80% on 15% of the course: average is 80, not 12.
    expect(s.currentAverage).toBeCloseTo(80, 10);
    expect(s.earnedPoints).toBeCloseTo(12, 10);
    expect(s.earnedPercent).toBeCloseTo(12, 10);
  });

  it("treats an explicit zero as zero", () => {
    const s = summarize(specCourse({ m1: 80, asg: 0 }));
    expect(s.gradedWeight).toBe(25);
    expect(s.earnedPoints).toBeCloseTo(12, 10);
    expect(s.currentAverage).toBeCloseTo(48, 10);
  });

  it("distinguishes average on completed work from overall earned so far", () => {
    // Everything except the final graded at 68% average.
    const s = summarize(specCourse({ m1: 60, m2: 70, asg: 80, labs: 66 }));
    // points: 9 + 14 + 8 + 9.9 = 40.9 over 60 weight
    expect(s.earnedPoints).toBeCloseTo(40.9, 10);
    expect(s.currentAverage).toBeCloseTo((40.9 / 60) * 100, 10);
    expect(s.earnedPercent).toBeCloseTo(40.9, 10);
    expect(s.remainingWeight).toBe(40);
  });

  it("supports raw scores", () => {
    const s = summarize([item({ weight: 50, score: 34, maxScore: 40 }), item({ weight: 50 })]);
    expect(s.items[0].percent).toBeCloseTo(85, 10);
    expect(s.earnedPoints).toBeCloseTo(42.5, 10);
  });

  it("handles a partial grading structure", () => {
    const s = summarize([item({ weight: 20, score: 90 }), item({ weight: 20 })]);
    expect(s.structureWeight).toBe(40);
    expect(s.unallocatedWeight).toBe(60);
    expect(s.openWeight).toBe(80);
    expect(s.currentAverage).toBeCloseTo(90, 10);
    expect(s.projectedFinal).toBeCloseTo(90, 10);
    expect(s.maxPossible).toBeCloseTo(98, 10);
  });

  it("adds bonus points without increasing the denominator", () => {
    const s = summarize([
      item({ weight: 50, score: 80 }),
      item({ weight: 50 }),
      item({ weight: 5, score: 100, isBonus: true }),
    ]);
    expect(s.structureWeight).toBe(50 + 50);
    expect(s.bonusPoints).toBeCloseTo(5, 10);
    expect(s.earnedPoints).toBeCloseTo(45, 10);
    expect(s.currentAverage).toBeCloseTo(90, 10);
  });

  it("ignores excused assessments", () => {
    const s = summarize([item({ weight: 50, score: 80 }), item({ weight: 50, excused: true })]);
    expect(s.structureWeight).toBe(50);
    expect(s.unallocatedWeight).toBe(50);
  });

  it("warns and rescales when weights exceed 100%", () => {
    const s = summarize([item({ weight: 60, score: 100 }), item({ weight: 60, score: 50 })]);
    expect(s.basis).toBe(120);
    expect(s.warnings.length).toBe(1);
    expect(s.earnedPercent).toBeCloseTo(75, 10);
  });

  it("does not accumulate floating point error", () => {
    const items = Array.from({ length: 10 }, () => item({ weight: 10, score: 70.1 }));
    const s = summarize(items);
    expect(s.structureWeight).toBe(100);
    expect(round(s.earnedPercent, 2)).toBe(70.1);
  });
});

describe("drop rules", () => {
  const labs = () => [
    item({ id: "l1", category: "Labs", weight: 5, score: 40 }),
    item({ id: "l2", category: "Labs", weight: 5, score: 90 }),
    item({ id: "l3", category: "Labs", weight: 5, score: 80 }),
    item({ id: "l4", category: "Labs", weight: 5, score: null }),
    item({ id: "exam", weight: 80, score: null }),
  ];

  it("only drops when a rule is configured", () => {
    const s = summarize(labs());
    expect(s.items.every((r) => !r.dropped)).toBe(true);
  });

  it("drops the lowest graded item and redistributes the category weight", () => {
    const s = summarize(labs(), [{ category: "labs", dropLowest: 1 }]);
    const l1 = s.items.find((r) => r.id === "l1")!;
    expect(l1.dropped).toBe(true);
    expect(l1.points).toBe(0);
    // 20% shared by the 3 kept labs
    const kept = s.items.filter((r) => r.category === "Labs" && !r.dropped);
    for (const k of kept) expect(k.effectiveWeight).toBeCloseTo(20 / 3, 10);
    expect(s.structureWeight).toBeCloseTo(100, 10);
    expect(s.currentAverage).toBeCloseTo(85, 10);
  });

  it("always keeps at least one graded item", () => {
    const s = summarize(
      [item({ category: "Quiz", weight: 10, score: 50 }), item({ category: "Quiz", weight: 10 })],
      [{ category: "Quiz", dropLowest: 1 }],
    );
    expect(s.items.some((r) => r.dropped)).toBe(false);
    expect(s.structureWeight).toBeCloseTo(20, 10);
  });
});

describe("requiredForTarget", () => {
  it("matches the spec example (68% current, 40% final)", () => {
    // 60% of the course graded at an average of exactly 68%.
    const items = [item({ weight: 60, score: 68 }), item({ id: "final", weight: 40 })];
    const s = summarize(items);
    expect(s.currentAverage).toBeCloseTo(68, 10);
    const r = (t: number) => requiredForTarget(s, t);
    // earned 40.8 points; needed = (T - 40.8) / 40 * 100
    expect(r(50).required).toBeCloseTo(23, 10);
    expect(r(60).required).toBeCloseTo(48, 10);
    expect(r(70).required).toBeCloseTo(73, 10);
    expect(r(80).required).toBeCloseTo(98, 10);
    expect(r(80).status).toBe("achievable");
    expect(r(90).status).toBe("impossible");
    expect(r(90).maxPossible).toBeCloseTo(80.8, 10);
  });

  it("reports secured targets", () => {
    const s = summarize([item({ weight: 90, score: 100 }), item({ weight: 10 })]);
    const r = requiredForTarget(s, 50);
    expect(r.status).toBe("secured");
    expect(r.required!).toBeLessThan(0);
  });

  it("reports exactly-100 as achievable, not impossible", () => {
    const s = summarize([item({ weight: 50, score: 80 }), item({ weight: 50 })]);
    expect(requiredForTarget(s, 90).status).toBe("achievable");
    expect(requiredForTarget(s, 90).required).toBeCloseTo(100, 10);
  });

  it("handles a completed course", () => {
    const s = summarize([item({ weight: 100, score: 72 })]);
    expect(requiredForTarget(s, 80).status).toBe("complete");
    expect(requiredForTarget(s, 70).status).toBe("secured");
  });
});

describe("requiredOnAssessment", () => {
  it("solves for the final exam given an assumption for other open work", () => {
    const items = specCourse({ m1: 70, m2: 70, asg: 90 }); // labs + final open
    const s = summarize(items);
    // earned: 10.5 + 14 + 9 = 33.5; labs (15) assumed 80 => 12; target 70 => 70 - 45.5 = 24.5 over 40 => 61.25
    const r = requiredOnAssessment(s, "final", 70, 80)!;
    expect(r.required).toBeCloseTo(61.25, 10);
    expect(r.status).toBe("achievable");
  });

  it("returns null for graded or unknown assessments", () => {
    const s = summarize(specCourse({ m1: 70 }));
    expect(requiredOnAssessment(s, "m1", 70, 70)).toBeNull();
    expect(requiredOnAssessment(s, "nope", 70, 70)).toBeNull();
  });
});

describe("scenarios", () => {
  it("applies hypothetical grades without touching entered grades", () => {
    const items = specCourse({ m1: 60, m2: 70, asg: 80, labs: 66 });
    const final = scenarioFinal(items, [], { final: 75, m1: 0 }, 0);
    // 40.9 + 30 = 70.9 — m1 hypothetical ignored because it is already graded
    expect(final).toBeCloseTo(70.9, 10);
  });

  it("uses the fallback for unspecified open work and unallocated weight", () => {
    const items = [item({ weight: 40, score: 50 }), item({ id: "x", weight: 30 })];
    // 20 + 30*0.8 + 30*0.6 = 62
    expect(scenarioFinal(items, [], { x: 80 }, 60)).toBeCloseTo(62, 10);
  });

  it("produces a monotonic outcome curve from min to max possible", () => {
    const items = specCourse({ m1: 60, m2: 70 });
    const s = summarize(items);
    const curve = outcomeCurve(items, []);
    expect(curve[0].final).toBeCloseTo(s.minPossible, 10);
    expect(curve.at(-1)!.final).toBeCloseTo(s.maxPossible, 10);
    for (let i = 1; i < curve.length; i++) expect(curve[i].final).toBeGreaterThanOrEqual(curve[i - 1].final);
  });
});

describe("helpers", () => {
  it("rounds half away from zero without binary artefacts", () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.675, 2)).toBe(2.68);
    expect(round(-1.005, 2)).toBe(-1.01);
    expect(round(79.995, 2)).toBe(80);
  });

  it("maps percentages to letter bands", () => {
    const scale = [
      { label: "A", min: 80 },
      { label: "B", min: 68 },
      { label: "F", min: 0 },
    ];
    expect(bandFor(80, scale)?.label).toBe("A");
    expect(bandFor(79.99, scale)?.label).toBe("B");
    expect(bandFor(null, scale)).toBeNull();
  });

  it("explains the calculation", () => {
    const lines = explain(summarize(specCourse({ m1: 80 })));
    expect(lines[0]).toContain("80.00% × 15.00% weight = 12.00 points");
    expect(lines.some((l) => l.includes("not counted as zero"))).toBe(true);
  });
});
