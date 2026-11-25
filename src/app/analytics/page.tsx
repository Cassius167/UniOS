"use client";

import { useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Card, CardHeader, EmptyState, PageHeader, Segmented, Select } from "@/components/ui/primitives";
import { Bars, Lines, ShareBars } from "@/components/charts";
import { useStore } from "@/lib/store";
import { useActiveCourses, useGradeSummaries, useNow } from "@/lib/hooks";
import { consistency, gradeProgression, minutesByCourse, minutesByDay, productivity, upcomingWorkload, weekRange } from "@/lib/analytics";
import { bandFor, round } from "@/lib/grades/engine";
import { DISTRACTION_KINDS } from "@/lib/types";
import { DISTRACTION_LABEL, TONES } from "@/lib/labels";
import { hours, pct } from "@/lib/utils";

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-5 py-5 shadow-soft">
      <div className="eyebrow mb-3">{label}</div>
      <div className="num font-serif text-4xl leading-none text-ink">{value}</div>
      {sub && <div className="mt-2 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const now = useNow(60_000);
  const data = useStore((s) => s.data);
  const courses = useActiveCourses();
  const summaries = useGradeSummaries();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [progCourse, setProgCourse] = useState<string>("");

  const a = useMemo(() => {
    if (!now) return null;
    const range = period === "week" ? weekRange(now, data.settings.weekStartsOn) : { start: startOfMonth(now), end: endOfMonth(now) };
    const prod = productivity(data, range);
    const byDay = minutesByDay(data, range);
    const byCourse = minutesByCourse(data, range);
    const weeks = consistency(data, now, 8, data.settings.weekStartsOn);
    const workload = upcomingWorkload(data, now, 6, data.settings.weekStartsOn);
    const distractions = DISTRACTION_KINDS.map((k) => ({ k, n: prod.sessions.reduce((s, x) => s + x.distractions.filter((d) => d.kind === k).length, 0) }));
    const allTimeCompletion = data.assignments.filter((x) => new Date(x.dueAt) < now);
    return { range, prod, byDay, byCourse, weeks, workload, distractions, allTimeCompletion };
  }, [now, data, period]);

  if (!now || !a) return null;

  const graded = courses.filter((c) => summaries.get(c.id)?.currentAverage != null);
  const credits = graded.reduce((s, c) => s + (c.credits ?? 1), 0);
  const avg = graded.length ? graded.reduce((s, c) => s + summaries.get(c.id)!.currentAverage! * (c.credits ?? 1), 0) / credits : null;
  const pastDue = a.allTimeCompletion;
  const pastDoneRate = pastDue.length ? (pastDue.filter((x) => x.status === "completed").length / pastDue.length) * 100 : null;
  const selCourse = progCourse || graded[0]?.id || "";
  const progression = selCourse ? gradeProgression(data, selCourse) : [];
  const activeWeeks = a.weeks.filter((w) => w.minutes > 0).length;

  return (
    <div>
      <PageHeader
       
        title="Analytics"
        subtitle="Every figure is calculated from what you’ve recorded: grades, completed assignments and focus sessions."
        actions={
          <Segmented
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "week", label: "This week" },
              { value: "month", label: "This month" },
            ]}
          />
        }
      />

      <h2 className="eyebrow mb-3">Academic</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Average across courses" value={avg === null ? "—" : `${round(avg, 1)}%`} sub={avg === null ? "No grades yet" : `${bandFor(avg, data.settings.gradingScale)?.label} · credit-weighted, ${graded.length} courses`} />
        <Kpi label="Assignment completion" value={pastDoneRate === null ? "—" : pct(pastDoneRate, 0)} sub={`${pastDue.filter((x) => x.status === "completed").length} of ${pastDue.length} past-due assignments done`} />
        <Kpi label={`Completed ${period === "week" ? "this week" : "this month"}`} value={a.prod.completedCount} sub="assignments marked complete" />
        <Kpi label="Open workload" value={`${round(a.workload.reduce((s, w) => s + w.hours, 0), 1)}h`} sub={`${a.workload.reduce((s, w) => s + w.count, 0)} assignments due in the next 6 weeks`} />
      </div>

      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Average on completed work" title="Course performance" />
          {graded.length ? (
            <div className="px-5 py-5">
              <ShareBars
                rows={courses.map((c) => ({ key: c.id, label: c.code, value: summaries.get(c.id)?.currentAverage ?? 0, color: TONES[c.tone] }))}
                format={(v) => (v ? `${round(v, 1)}%` : "—")}
              />
            </div>
          ) : (
            <EmptyState title="No grades yet" body="Enter assessment results in the Grade Tracker." />
          )}
        </Card>
        <Card>
          <CardHeader
            eyebrow="Running average by assessment date"
            title="Grade progression"
            action={
              graded.length > 0 && (
                <Select value={selCourse} onChange={(e) => setProgCourse(e.target.value)} className="h-7 w-auto text-xs" aria-label="Course">
                  {graded.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              )
            }
          />
          {progression.length > 1 ? (
            <div className="px-3 pb-3 pt-4">
              <Lines data={progression.map((p) => ({ ...p, average: round(p.average, 2) }))} x="date" y="average" format={(v) => `${round(v, 0)}%`} xLabel={(d) => format(new Date(`${d}T00:00:00`), "d MMM")} refs={[{ y: data.settings.passingGrade, label: "Pass" }]} />
            </div>
          ) : (
            <EmptyState title="Not enough dated grades" body="Grade progression appears once a course has two or more graded assessments with dates." />
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Estimated hours of work left, by due week" title="Upcoming academic workload" />
          <div className="px-3 pb-3 pt-4">
            <Bars data={a.workload.map((w) => ({ ...w, hours: round(w.hours, 1) }))} x="label" y="hours" height={170} format={(v) => `${v}h`} />
          </div>
          <p className="border-t border-line px-5 py-2.5 text-[11px] text-faint">Uses each open assignment’s estimated workload, reduced by the share of subtasks already done. Assignments without an estimate count as 0h.</p>
        </Card>
      </div>

      <h2 className="eyebrow mb-3">Productivity · {format(a.range.start, "d MMM")} – {format(a.range.end, "d MMM")}</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total study time" value={hours(a.prod.minutes)} sub={`${a.prod.sessionCount} focus sessions`} />
        <Kpi label="Average session" value={a.prod.avgSessionMinutes === null ? "—" : hours(a.prod.avgSessionMinutes)} sub={a.prod.avgRating === null ? "No ratings" : `Average rating ${round(a.prod.avgRating, 1)} / 5`} />
        <Kpi label="Distractions logged" value={a.prod.distractions} sub={a.prod.sessionCount ? `${round(a.prod.distractions / a.prod.sessionCount, 2)} per session` : "—"} />
        <Kpi label="Weekly consistency" value={`${activeWeeks}/8`} sub="weeks with at least one session" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader eyebrow="Minutes focused" title="Study time by day" />
          <div className="px-3 pb-3 pt-4">
            <Bars data={a.byDay.map((d) => ({ ...d, label: period === "week" ? d.label : d.short }))} x="label" y="minutes" format={(v) => hours(v)} height={190} />
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title="Study time by course" />
          {a.byCourse.length ? (
            <div className="px-5 py-5">
              <ShareBars rows={a.byCourse.map((c) => ({ key: c.courseId, label: c.label, value: c.minutes, color: TONES[c.tone] }))} format={hours} />
            </div>
          ) : (
            <EmptyState title="No sessions in this period" body="Start a Focus session to begin tracking." />
          )}
        </Card>
        <Card className="lg:col-span-8">
          <CardHeader eyebrow="Last 8 weeks" title="Weekly consistency" />
          <div className="px-3 pb-3 pt-4">
            <Bars data={a.weeks} x="label" y="minutes" format={(v) => hours(v)} height={170} highlightIndex={a.weeks.length - 1} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-5 py-2.5 text-[11px] text-faint">
            {a.weeks.map((w) => (
              <span key={w.label} className="num">
                {w.label}: {w.days}d
              </span>
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title="Distractions by type" />
          {a.prod.distractions ? (
            <div className="px-5 py-5">
              <ShareBars rows={a.distractions.filter((d) => d.n).map((d) => ({ key: d.k, label: DISTRACTION_LABEL[d.k], value: d.n, color: "var(--terra)" }))} format={(v) => String(v)} />
            </div>
          ) : (
            <EmptyState title="None logged" body="Log distractions during a focus session to see patterns here." />
          )}
        </Card>
      </div>
    </div>
  );
}
