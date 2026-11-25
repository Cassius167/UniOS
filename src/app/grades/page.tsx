"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Calculator, ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, DemoBadge, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { Lines } from "@/components/charts";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useActiveCourses, useGradeSummaries } from "@/lib/hooks";
import {
  bandFor,
  explain,
  outcomeCurve,
  requiredForTarget,
  requiredOnAssessment,
  round,
  scenarioFinal,
  summarize,
  type GradeSummary,
  type TargetResult,
} from "@/lib/grades/engine";
import type { Assessment, Course } from "@/lib/types";
import { TONES } from "@/lib/labels";
import { cn } from "@/lib/utils";

const f2 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : round(n, 2).toFixed(2));

function TargetCell({ r }: { r: TargetResult }) {
  if (r.status === "secured") return <span className="text-accent-ink">Secured</span>;
  if (r.status === "complete") return <span className="text-faint">Not reached</span>;
  if (r.status === "impossible")
    return (
      <span className="text-terra" title={`Highest possible: ${f2(r.maxPossible)}%`}>
        Not possible <span className="num text-[11px] text-faint">(would need {f2(r.required)}%)</span>
      </span>
    );
  return <span className="num text-ink">{f2(r.required)}%</span>;
}

function DropRules({ course, categories }: { course: Course; categories: string[] }) {
  const update = useStore((s) => s.update);
  const rules = course.dropRules;
  const set = (next: Course["dropRules"]) => update("courses", course.id, { dropRules: next });
  return (
    <div className="flex flex-col gap-2">
      {rules.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-muted">Drop lowest</span>
          <Input
            type="number"
            min={1}
            value={r.dropLowest}
            onChange={(e) => set(rules.map((x, j) => (j === i ? { ...x, dropLowest: Math.max(1, Number(e.target.value) || 1) } : x)))}
            className="num h-8 w-14"
            aria-label="Number to drop"
          />
          <span className="text-muted">in</span>
          <Select value={r.category} onChange={(e) => set(rules.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} className="h-8 w-auto" aria-label="Category">
            {[...new Set([r.category, ...categories])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Button size="icon" variant="ghost" onClick={() => set(rules.filter((_, j) => j !== i))} aria-label="Remove rule">
            <Trash2 className="!size-3.5" />
          </Button>
        </div>
      ))}
      {categories.length > 0 ? (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => set([...rules, { category: categories[0], dropLowest: 1 }])}>
          <Plus /> Add drop rule
        </Button>
      ) : (
        <p className="text-xs text-faint">Give assessments a shared category (e.g. “Quizzes”) to drop the lowest.</p>
      )}
      <p className="text-[11px] leading-relaxed text-faint">Kept items in the category share its total weight equally. Only graded items are dropped, and at least one is always kept.</p>
    </div>
  );
}

function CourseGrades({ course, items, summary }: { course: Course; items: Assessment[]; summary: GradeSummary }) {
  const settings = useStore((s) => s.data.settings);
  const openForm = useUI((s) => s.openForm);
  const [showExplain, setShowExplain] = useState(false);
  const [hypo, setHypo] = useState<Record<string, number>>({});
  const open = summary.items.filter((r) => !r.graded && !r.isBonus && !r.dropped);
  const finalCandidate = [...open].sort((a, b) => b.effectiveWeight - a.effectiveWeight)[0];
  const [focusId, setFocusId] = useState<string>(finalCandidate?.id ?? "");
  const avg = summary.currentAverage;
  const [assume, setAssume] = useState<number>(avg !== null ? Math.round(Math.min(100, avg)) : 70);

  useEffect(() => {
    setHypo({});
    setFocusId(finalCandidate?.id ?? "");
    setAssume(avg !== null ? Math.round(Math.min(100, avg)) : 70);
    // reset when switching course
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  const defaultHypo = avg !== null ? Math.round(Math.min(100, avg)) : 70;
  const scenarioValues = Object.fromEntries(open.map((r) => [r.id, hypo[r.id] ?? defaultHypo]));
  const simulated = scenarioFinal(items, course.dropRules, scenarioValues, defaultHypo);
  const curve = useMemo(() => outcomeCurve(items, course.dropRules, 5), [items, course.dropRules]);

  const targets = [...new Set([50, 60, 70, 80, 90, settings.passingGrade, ...(course.targetGrade ? [course.targetGrade] : [])])].sort((a, b) => a - b);
  const band = bandFor(avg, settings.gradingScale);
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];
  const weightOk = Math.abs(summary.structureWeight - 100) < 1e-6;

  return (
    <div className="flex flex-col gap-6">
      {/* Key numbers */}
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4">
          {[
            { l: "Average on completed work", v: avg === null ? "—" : `${f2(avg)}%`, s: band ? `${band.label} on your grading scale` : "No grades entered yet" },
            { l: "Course percentage earned so far", v: `${f2(summary.earnedPercent)}%`, s: `of 100 · locked in${summary.bonusPoints ? ` · incl. ${f2(summary.bonusPoints)} bonus` : ""}` },
            { l: "Weight graded / remaining", v: `${f2(summary.gradedWeight)} / ${f2(summary.openWeight)}`, s: summary.unallocatedWeight > 0 ? `${f2(summary.unallocatedWeight)}% not yet in the structure` : "percent of course" },
            { l: "Projected final", v: summary.projectedFinal === null ? "—" : `${f2(summary.projectedFinal)}%`, s: `Range ${f2(summary.minPossible)}–${f2(summary.maxPossible)}% · if you keep your average` },
          ].map((x, i) => (
            <div key={x.l} className={cn("px-5 py-5", i > 0 && "md:border-l", i % 2 === 1 && "border-l", i >= 2 && "border-t md:border-t-0", "border-line")}>
              <div className="eyebrow mb-3 leading-snug">{x.l}</div>
              <div className="num text-2xl leading-none whitespace-nowrap text-ink">{x.v}</div>
              <div className="mt-2 text-[11px] leading-snug text-muted">{x.s}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-5 py-2.5 text-[11px] text-faint">
          The projection is an estimate that assumes you score your current average on everything left. Facts above it are calculated only from grades you have entered.
        </div>
      </Card>

      {summary.warnings.map((w) => (
        <div key={w} className="flex items-center gap-2 rounded-xl border border-terra/40 bg-terra-soft px-4 py-2.5 text-xs text-terra">
          <AlertTriangle className="size-3.5" /> {w}
        </div>
      ))}

      {/* Assessments */}
      <Card>
        <CardHeader
          eyebrow={`Grading structure · ${f2(summary.structureWeight)}% defined`}
          title="Assessments"
          action={
            <Button size="sm" onClick={() => openForm({ kind: "assessment", defaults: { courseId: course.id } })}>
              <Plus /> Add
            </Button>
          }
        />
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="eyebrow border-b border-line text-left">
                  <th className="px-5 py-2.5 font-normal">Assessment</th>
                  <th className="px-3 py-2.5 text-right font-normal">Weight</th>
                  <th className="px-3 py-2.5 text-right font-normal">Score</th>
                  <th className="px-3 py-2.5 text-right font-normal">Percent</th>
                  <th className="px-5 py-2.5 text-right font-normal">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {summary.items.map((r) => {
                  const a = items.find((x) => x.id === r.id)!;
                  return (
                    <tr key={r.id} onClick={() => openForm({ kind: "assessment", id: r.id })} className="cursor-pointer hover:bg-surface-2/60">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-ink", r.dropped && "text-faint line-through")}>{r.name}</span>
                          {r.isBonus && <Badge tone="sage">Bonus</Badge>}
                          {r.dropped && <Badge tone="outline">Dropped</Badge>}
                          {a.isDemo && <DemoBadge />}
                        </div>
                        <div className="num text-[10px] text-faint">
                          {r.category}
                          {r.date ? ` · ${r.date}` : ""}
                        </div>
                      </td>
                      <td className="num px-3 py-2.5 text-right text-ink">
                        {f2(r.effectiveWeight)}%{Math.abs(r.effectiveWeight - r.weight) > 1e-9 && <div className="text-[10px] text-faint">entered {f2(r.weight)}%</div>}
                      </td>
                      <td className="num px-3 py-2.5 text-right text-muted">{r.graded ? `${a.score} / ${a.maxScore}` : <span className="text-faint">Not graded</span>}</td>
                      <td className="num px-3 py-2.5 text-right text-ink">{r.percent === null ? "—" : `${f2(r.percent)}%`}</td>
                      <td className="num px-5 py-2.5 text-right text-ink">{r.graded ? f2(r.points) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong">
                  <td className="px-5 py-2.5 text-xs text-muted">Total</td>
                  <td className={cn("num px-3 py-2.5 text-right", weightOk ? "text-ink" : "text-ochre")}>{f2(summary.structureWeight)}%</td>
                  <td colSpan={2} />
                  <td className="num px-5 py-2.5 text-right text-ink">{f2(summary.earnedPoints)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No grading structure yet"
            body="Add each assessment with its weight from the syllabus. Leave the score empty until it’s marked: it won’t count as zero."
            action={<Button size="sm" variant="primary" onClick={() => openForm({ kind: "assessment", defaults: { courseId: course.id } })}>Add first assessment</Button>}
          />
        )}
        {items.length > 0 && (
          <div className="border-t border-line">
            <button onClick={() => setShowExplain((s) => !s)} className="flex w-full items-center gap-2 px-5 py-2.5 text-xs text-muted hover:text-ink" aria-expanded={showExplain}>
              <Calculator className="size-3.5" /> {showExplain ? "Hide" : "Explain"} the calculation <ChevronDown className={cn("size-3 transition-transform", showExplain && "rotate-180")} />
            </button>
            {showExplain && (
              <ol className="num list-decimal space-y-1 px-10 pb-4 text-[11px] leading-relaxed text-ink-2">
                {explain(summary).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Card>

      {items.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Targets */}
          <Card>
            <CardHeader eyebrow="What you need on the remaining work" title="Targets" />
            <div className="px-5 py-4">
              <p className="mb-3 text-xs text-muted">Average needed on all remaining work ({f2(summary.openWeight)}% of the course):</p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line/60">
                  {targets.map((t) => (
                    <tr key={t}>
                      <td className="num py-2 text-ink">
                        {t}% overall
                        {t === settings.passingGrade && <span className="ml-2 text-[10px] text-faint">pass</span>}
                        {t === course.targetGrade && <span className="ml-2 text-[10px] text-accent-ink">your target</span>}
                      </td>
                      <td className="py-2 text-right">
                        <TargetCell r={requiredForTarget(summary, t)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {open.length > 0 && (
              <div className="border-t border-line px-5 py-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                  Grade needed on
                  <Select value={focusId} onChange={(e) => setFocusId(e.target.value)} className="h-8 w-auto" aria-label="Assessment to solve for">
                    {open.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({f2(r.effectiveWeight)}%)
                      </option>
                    ))}
                  </Select>
                  {summary.openWeight - (open.find((o) => o.id === focusId)?.effectiveWeight ?? 0) > 1e-9 && (
                    <>
                      if other open work scores
                      <Input type="number" min={0} max={100} value={assume} onChange={(e) => setAssume(Math.max(0, Math.min(100, Number(e.target.value))))} className="num h-8 w-16" aria-label="Assumed score on other work" />%
                    </>
                  )}
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-line/60">
                    {targets.map((t) => {
                      const r = requiredOnAssessment(summary, focusId, t, assume);
                      return (
                        r && (
                          <tr key={t}>
                            <td className="num py-2 text-ink">{t}% overall</td>
                            <td className="py-2 text-right">
                              <TargetCell r={r} />
                            </td>
                          </tr>
                        )
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Scenario simulator */}
          <Card>
            <CardHeader
              eyebrow="Hypothetical"
              title="Scenario simulator"
              action={
                <Button size="sm" variant="ghost" onClick={() => setHypo({})}>
                  <RotateCcw /> Reset
                </Button>
              }
            />
            <div className="px-5 py-4">
              <div className="mb-4 flex items-end justify-between rounded-xl bg-surface-2 px-4 py-3">
                <div>
                  <div className="eyebrow">Simulated final grade</div>
                  <div className="num text-3xl text-ink">{f2(simulated)}%</div>
                </div>
                <div className="text-right text-xs text-muted">
                  {bandFor(simulated, settings.gradingScale)?.label ?? ""}
                  <div className="text-[10px] text-faint">{simulated + 1e-9 >= settings.passingGrade ? "Pass" : "Below passing"}</div>
                </div>
              </div>
              {open.length ? (
                <div className="flex flex-col gap-3">
                  {open.map((r) => (
                    <label key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                      <span className="truncate text-xs text-ink">
                        {r.name} <span className="num text-faint">· {f2(r.effectiveWeight)}%</span>
                      </span>
                      <span className="num w-12 text-right text-xs text-ink">{scenarioValues[r.id]}%</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={scenarioValues[r.id]}
                        onChange={(e) => setHypo((h) => ({ ...h, [r.id]: Number(e.target.value) }))}
                        className="col-span-2 w-full"
                        aria-label={`Hypothetical score for ${r.name}`}
                      />
                    </label>
                  ))}
                  {summary.unallocatedWeight > 1e-9 && <p className="text-[11px] text-faint">Unallocated weight ({f2(summary.unallocatedWeight)}%) uses your current average ({defaultHypo}%).</p>}
                </div>
              ) : (
                <p className="text-xs text-muted">Every assessment is graded. There’s nothing left to simulate.</p>
              )}
            </div>
            <div className="border-t border-line px-3 pb-2 pt-4">
              <div className="px-2 pb-1 text-[11px] text-muted">Final grade if you score the same on all remaining work</div>
              <Lines
                data={curve.map((c) => ({ score: `${c.score}%`, final: round(c.final, 2) }))}
                x="score"
                y="final"
                height={190}
                format={(v) => `${round(v, 1)}%`}
                refs={[{ y: settings.passingGrade, label: "Pass" }, ...(course.targetGrade ? [{ y: course.targetGrade, label: "Target", tone: "var(--accent)" }] : [])]}
              />
            </div>
          </Card>
        </div>
      )}

      {items.length > 0 && (
        <Card>
          <CardHeader title="Dropped grades" />
          <div className="px-5 py-4">
            <DropRules course={course} categories={categories} />
          </div>
        </Card>
      )}
    </div>
  );
}

function GradesInner() {
  const params = useSearchParams();
  const courses = useActiveCourses();
  const assessments = useStore((s) => s.data.assessments);
  const settings = useStore((s) => s.data.settings);
  const summaries = useGradeSummaries();
  const openForm = useUI((s) => s.openForm);
  const [selected, setSelected] = useState(params.get("course") ?? courses[0]?.id ?? "");
  const course = courses.find((c) => c.id === selected) ?? courses[0];
  const items = useMemo(() => assessments.filter((a) => a.courseId === course?.id), [assessments, course?.id]);
  const summary = useMemo(() => (course ? summarize(items, course.dropRules) : null), [items, course]);

  // Credit-weighted average across courses with grades.
  const graded = courses.filter((c) => summaries.get(c.id)?.currentAverage !== null && summaries.get(c.id));
  const totalCredits = graded.reduce((s, c) => s + (c.credits ?? 1), 0);
  const overall = graded.length ? graded.reduce((s, c) => s + summaries.get(c.id)!.currentAverage! * (c.credits ?? 1), 0) / totalCredits : null;

  return (
    <div>
      <PageHeader
       
        title="Grade Tracker"
        subtitle={
          overall === null ? "Enter assessments and grades to see your standing." : (
            <>
              Credit-weighted average on completed work across {graded.length} course{graded.length === 1 ? "" : "s"}: <span className="num text-ink">{f2(overall)}%</span> ({bandFor(overall, settings.gradingScale)?.label})
            </>
          )
        }
        actions={
          <Button variant="primary" onClick={() => openForm({ kind: "assessment", defaults: { courseId: course?.id } })} disabled={!courses.length}>
            <Plus /> Add assessment
          </Button>
        }
      />
      {!courses.length || !course || !summary ? (
        <Card>
          <EmptyState title="No courses yet" body="Grades are tracked per course. Add a course first." action={<Button size="sm" onClick={() => openForm({ kind: "course" })}>Add a course</Button>} />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Courses" className="flex gap-1 overflow-x-auto lg:flex-col">
            {courses.map((c) => {
              const s = summaries.get(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  aria-current={c.id === course.id}
                  className={cn("flex min-w-40 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors", c.id === course.id ? "border-line-strong bg-surface" : "border-transparent hover:bg-surface-2")}
                >
                  <span className="h-7 w-[3px] rounded-full" style={{ background: TONES[c.tone] }} />
                  <span className="min-w-0 flex-1">
                    <span className="num block text-xs text-ink">{c.code}</span>
                    <span className="block truncate text-[11px] text-muted">{c.name}</span>
                  </span>
                  <span className="num text-xs text-ink">{s?.currentAverage === null || !s ? "—" : round(s.currentAverage, 1).toFixed(1)}</span>
                </button>
              );
            })}
          </nav>
          <div>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-3xl text-ink">
                {course.code} <span className="text-muted">· {course.name}</span>
              </h2>
              <Link href={`/courses/${course.id}`} className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
                Course page
              </Link>
            </div>
            <CourseGrades course={course} items={items} summary={summary} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function GradesPage() {
  return (
    <Suspense>
      <GradesInner />
    </Suspense>
  );
}
