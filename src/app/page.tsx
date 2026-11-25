"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { ArrowUpRight, CalendarPlus, Info, ListPlus, SlidersHorizontal, Sparkle } from "lucide-react";
import { Button, Card, CardHeader, DemoBadge, EmptyState, Progress, Toggle } from "@/components/ui/primitives";
import { AssignmentRow, CourseTag, DueLabel, OccurrenceRow } from "@/components/domain";
import { Bars } from "@/components/charts";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useActiveCourses, useCourseMap, useGradeSummaries, useNow } from "@/lib/hooks";
import { expandEvents } from "@/lib/calendar/recurrence";
import { attentionLabel, completion, rankAssignments } from "@/lib/assignments/priority";
import { minutesByDay, productivity, weekRange } from "@/lib/analytics";
import { bandFor } from "@/lib/grades/engine";
import { DASHBOARD_WIDGETS, type DashboardWidget } from "@/lib/types";
import { TONES } from "@/lib/labels";
import { cn, greeting, hours, pct } from "@/lib/utils";

const WIDGET_LABEL: Record<DashboardWidget, string> = {
  today: "Today at a glance",
  schedule: "Today's schedule",
  priority: "Priority tasks",
  deadlines: "Upcoming deadlines",
  courses: "Course overview",
  productivity: "Productivity summary",
};

function CustomizeWidgets() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const widgets = useStore((s) => s.data.settings.dashboardWidgets);
  const updateSettings = useStore((s) => s.updateSettings);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <SlidersHorizontal /> Customize
      </Button>
      {open && (
        <div className="fade-in absolute right-0 top-9 z-20 w-64 rounded-[4px] border border-line bg-surface p-3 shadow-[0_12px_32px_-16px_rgba(24,36,43,0.35)]">
          <div className="eyebrow mb-2">Visible widgets</div>
          {DASHBOARD_WIDGETS.map((w) => (
            <label key={w} className="flex items-center justify-between py-1.5 text-sm text-ink">
              {WIDGET_LABEL[w]}
              <Toggle checked={widgets[w]} label={WIDGET_LABEL[w]} onChange={(v) => updateSettings({ dashboardWidgets: { ...widgets, [w]: v } })} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const now = useNow(30_000);
  const data = useStore((s) => s.data);
  const { settings } = data;
  const widgets = settings.dashboardWidgets;
  const openForm = useUI((s) => s.openForm);
  const courses = useActiveCourses();
  const courseMap = useCourseMap();
  const grades = useGradeSummaries();
  const semester = settings.semesters.find((s) => s.id === settings.currentSemesterId);

  const d = useMemo(() => {
    if (!now) return null;
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    const today = expandEvents(data.events, dayStart, dayEnd);
    const open = data.assignments.filter((a) => a.status !== "completed");
    const dueToday = open.filter((a) => isSameDay(new Date(a.dueAt), now));
    const subtasksToday = open.flatMap((a) => a.subtasks.filter((s) => !s.done && s.dueDate === format(now, "yyyy-MM-dd")));
    const overdue = open.filter((a) => new Date(a.dueAt) < now);
    const upcoming7 = open.filter((a) => new Date(a.dueAt) >= now && new Date(a.dueAt) <= addDays(now, 7));
    const completedToday = data.assignments.filter((a) => a.completedAt && isSameDay(new Date(a.completedAt), now));
    const studyEvents = today.filter((o) => o.event.type === "study");
    const plannedStudy = studyEvents.reduce((s, o) => s + (o.end.getTime() - o.start.getTime()) / 60000, 0);
    const studiedToday = data.sessions.filter((s) => isSameDay(new Date(s.startedAt), now)).reduce((s, x) => s + x.actualMinutes, 0);
    const ranked = rankAssignments(data.assignments, now);
    const examOcc = expandEvents(data.events.filter((e) => e.type === "exam"), now, addDays(now, 60));
    const deadlines = [
      ...open.filter((a) => new Date(a.dueAt) >= now).map((a) => ({ kind: "assignment" as const, at: new Date(a.dueAt), a })),
      ...examOcc.map((o) => ({ kind: "exam" as const, at: o.start, o })),
    ]
      .sort((x, y) => x.at.getTime() - y.at.getTime())
      .slice(0, 5);
    const week = weekRange(now, settings.weekStartsOn);
    const prod = productivity(data, week);
    const byDay = minutesByDay(data, week);
    return { today, dueToday, subtasksToday, overdue, upcoming7, completedToday, plannedStudy, studiedToday, ranked, deadlines, prod, byDay };
  }, [now, data, settings.weekStartsOn]);

  if (!now || !d) return null;

  const commitments = d.today.filter((o) => o.end > now).length;
  const summaryParts = [
    commitments ? `${commitments} commitment${commitments === 1 ? "" : "s"} still ahead today` : "nothing else on the calendar today",
    d.dueToday.length ? `${d.dueToday.length} assignment${d.dueToday.length === 1 ? "" : "s"} due today` : null,
    d.overdue.length ? `${d.overdue.length} overdue` : null,
  ].filter(Boolean);
  const top = d.ranked[0] ? data.assignments.find((a) => a.id === d.ranked[0].assignmentId) : undefined;
  const hasDemo = data.courses.some((c) => c.isDemo) || data.assignments.some((a) => a.isDemo);

  return (
    <div className="fade-in">
      {/* ───────── Header ───────── */}
      <header className="mb-10 grid gap-6 border-b border-line pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="num mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.1em] text-faint">
            <span>{format(now, "EEEE, MMMM d, yyyy")}</span>
            {semester && <span className="text-accent-ink">{semester.name}</span>}
          </div>
          <h1 className="font-serif text-5xl leading-[0.95] tracking-tight text-ink md:text-6xl">
            {greeting(now)}
            {settings.profile.name ? <span className="italic text-muted">, {settings.profile.name}.</span> : "."}
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
            You have {summaryParts.join(", ")}.
            {top && (
              <>
                {" "}
                Suggested next focus: <span className="text-ink">{top.title}</span>.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CustomizeWidgets />
          <Button size="sm" onClick={() => openForm({ kind: "event" })}>
            <CalendarPlus /> Event
          </Button>
          <Button size="sm" variant="primary" onClick={() => openForm({ kind: "assignment" })}>
            <ListPlus /> Assignment
          </Button>
        </div>
      </header>

      {hasDemo && (
        <div className="mb-8 flex items-start gap-3 rounded-[3px] border border-dashed border-line-strong px-4 py-3 text-xs text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            You’re looking at demonstration data for a sample UBCO engineering student. Courses, grades and deadlines marked <DemoBadge /> are not real. Edit them, or remove them all in{" "}
            <Link href="/settings#data" className="text-ink underline underline-offset-2">
              Settings → Data
            </Link>
            .
          </span>
        </div>
      )}

      {/* ───────── Today at a glance ───────── */}
      {widgets.today && (
        <section aria-label="Today at a glance" className="mb-10 grid grid-cols-2 border-y border-line md:grid-cols-4">
          {[
            { label: "Due today", value: d.dueToday.length + d.subtasksToday.length, sub: d.subtasksToday.length ? `${d.dueToday.length} assignments · ${d.subtasksToday.length} subtasks` : "assignments and subtasks" },
            { label: "Deadlines · next 7 days", value: d.upcoming7.length, sub: d.overdue.length ? <span className="text-terra">{d.overdue.length} overdue</span> : "none overdue" },
            { label: "Completed today", value: d.completedToday.length, sub: `${d.prod.completedCount} this week` },
            { label: "Planned study", value: hours(d.plannedStudy), sub: `${hours(d.studiedToday)} focused so far` },
          ].map((s, i) => (
            <div key={s.label} className={cn("px-5 py-5", i % 2 === 1 && "border-l border-line", i >= 2 && "border-t border-line md:border-t-0", i === 2 && "md:border-l")}>
              <div className="eyebrow mb-3">{s.label}</div>
              <div className="num text-4xl font-light leading-none text-ink">{s.value}</div>
              <div className="mt-2 text-xs text-muted">{s.sub}</div>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* ───────── Schedule ───────── */}
        {widgets.schedule && (
          <Card className="lg:col-span-5">
            <CardHeader
              eyebrow={format(now, "EEE d MMM")}
              title="Today’s schedule"
              action={
                <Link href="/calendar" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
                  Calendar <ArrowUpRight className="size-3" />
                </Link>
              }
            />
            {d.today.length ? (
              <div className="divide-y divide-line">
                {d.today.map((o) => (
                  <OccurrenceRow key={o.key} o={o} now={now} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="A clear day"
                body="No classes or commitments scheduled. Plan a study block to make the most of it."
                action={
                  <Button size="sm" onClick={() => openForm({ kind: "study", defaults: { date: format(now, "yyyy-MM-dd") } })}>
                    Plan study session
                  </Button>
                }
              />
            )}
          </Card>
        )}

        {/* ───────── Priority ───────── */}
        {widgets.priority && (
          <Card className={cn(widgets.schedule ? "lg:col-span-7" : "lg:col-span-12")}>
            <CardHeader
              eyebrow="Suggested order"
              title="Priority tasks"
              action={
                <Link href="/assignments?view=priority" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
                  All assignments <ArrowUpRight className="size-3" />
                </Link>
              }
            />
            {d.ranked.length ? (
              <>
                <div className="divide-y divide-line">
                  {d.ranked.slice(0, 6).map((r) => {
                    const a = data.assignments.find((x) => x.id === r.assignmentId)!;
                    return (
                      <AssignmentRow
                        key={a.id}
                        a={a}
                        extra={
                          <span className={cn("text-[11px]", r.score >= 60 ? "text-terra" : "text-faint")} title={r.factors.map((f) => f.label).join(" · ")}>
                            {attentionLabel(r.score)}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
                <p className="flex items-center gap-1.5 border-t border-line px-5 py-2.5 text-[11px] text-faint">
                  <Sparkle className="size-3" /> Ranking is a recommendation based on deadline, priority, workload and open subtasks. Hover a label to see why.
                </p>
              </>
            ) : (
              <EmptyState title="Nothing outstanding" body="Every assignment is complete. Add the next one when it’s announced." action={<Button size="sm" onClick={() => openForm({ kind: "assignment" })}>Add assignment</Button>} />
            )}
          </Card>
        )}

        {/* ───────── Deadlines ───────── */}
        {widgets.deadlines && (
          <Card className="lg:col-span-5">
            <CardHeader eyebrow="Next five" title="Upcoming deadlines" />
            {d.deadlines.length ? (
              <ol className="divide-y divide-line">
                {d.deadlines.map((x, i) => {
                  const hoursLeft = (x.at.getTime() - now.getTime()) / 36e5;
                  const bar = hoursLeft < 24 ? "bg-terra" : hoursLeft < 72 ? "bg-ochre" : "bg-line-strong";
                  const title = x.kind === "assignment" ? x.a.title : x.o.event.title;
                  const course = courseMap.get((x.kind === "assignment" ? x.a.courseId : x.o.event.courseId) ?? "");
                  return (
                    <li key={i}>
                      <button
                        onClick={() => (x.kind === "assignment" ? openForm({ kind: "assignment", id: x.a.id }) : openForm({ kind: "event", id: x.o.event.id, occurrenceDate: x.o.isRecurring ? x.o.dateKey : undefined }))}
                        className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-surface-2/60"
                      >
                        <span className={cn("h-8 w-[3px] shrink-0 rounded-full", bar)} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-ink">{title}</div>
                          <div className="mt-0.5 flex items-center gap-3">
                            <CourseTag course={course} />
                            {x.kind === "exam" && <span className="text-[11px] text-terra">Exam</span>}
                          </div>
                        </div>
                        <DueLabel iso={x.at.toISOString()} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState title="No upcoming deadlines" body="Assignments and exams you add will appear here in date order." />
            )}
          </Card>
        )}

        {/* ───────── Productivity ───────── */}
        {widgets.productivity && (
          <Card className={cn(widgets.deadlines ? "lg:col-span-7" : "lg:col-span-12")}>
            <CardHeader
              eyebrow="This week"
              title="Productivity"
              action={
                <Link href="/analytics" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
                  Analytics <ArrowUpRight className="size-3" />
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
              {[
                ["Study time", hours(d.prod.minutes)],
                ["Assignments done", d.prod.completedCount],
                ["Focus sessions", d.prod.sessionCount],
                ["Completion rate", d.prod.completionRate === null ? "—" : pct(d.prod.completionRate, 0)],
              ].map(([l, v]) => (
                <div key={l as string} className="bg-surface px-5 py-4">
                  <div className="eyebrow mb-2">{l}</div>
                  <div className="num text-xl text-ink">{v}</div>
                </div>
              ))}
            </div>
            <div className="px-3 pb-3 pt-4">
              <Bars data={d.byDay} x="label" y="minutes" height={140} format={(v) => hours(v)} highlightIndex={d.byDay.findIndex((x) => isSameDay(x.date, now))} />
            </div>
            <p className="border-t border-line px-5 py-2.5 text-[11px] text-faint">Completion rate = assignments due this week that are marked complete ({d.prod.dueCompletedCount} of {d.prod.dueCount}).</p>
          </Card>
        )}

        {/* ───────── Courses ───────── */}
        {widgets.courses && (
          <section className="lg:col-span-12" aria-label="Course overview">
            <div className="mb-3 mt-4 flex items-end justify-between">
              <div>
                <div className="eyebrow mb-1">{semester?.name ?? "Active courses"}</div>
                <h2 className="font-serif text-3xl text-ink">Courses</h2>
              </div>
              <Link href="/courses" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
                All courses <ArrowUpRight className="size-3" />
              </Link>
            </div>
            {courses.length ? (
              <div className="grid overflow-hidden rounded-[4px] border-l border-t border-line sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((c) => {
                  const g = grades.get(c.id);
                  const next = data.assignments.filter((a) => a.courseId === c.id && a.status !== "completed").sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
                  const courseAsg = data.assignments.filter((a) => a.courseId === c.id);
                  const progress = courseAsg.length ? courseAsg.reduce((s, a) => s + completion(a), 0) / courseAsg.length : 0;
                  const band = bandFor(g?.currentAverage ?? null, settings.gradingScale);
                  return (
                    <Link key={c.id} href={`/courses/${c.id}`} className="group flex flex-col gap-4 border-b border-r border-line bg-surface p-5 transition-colors hover:bg-surface-2/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="num flex items-center gap-2 text-xs text-muted">
                            <span className="inline-block h-3 w-[3px] rounded-full" style={{ background: TONES[c.tone] }} />
                            {c.code}
                            {c.isDemo && <DemoBadge />}
                          </div>
                          <div className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-ink">{c.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="num text-2xl leading-none text-ink">{g?.currentAverage === null || !g ? "—" : g.currentAverage.toFixed(1)}</div>
                          <div className="num mt-1 text-[10px] text-faint">{band ? `${band.label} · current` : "no grades"}</div>
                        </div>
                      </div>
                      <div className="mt-auto">
                        <div className="mb-1.5 flex items-center justify-between text-[11px]">
                          <span className="truncate text-muted">{next ? `Next: ${next.title}` : "No open assignments"}</span>
                          {next && <DueLabel iso={next.dueAt} />}
                        </div>
                        <Progress value={progress} />
                        <div className="num mt-1 text-[10px] text-faint">{courseAsg.length ? `${Math.round(progress)}% of assignment work done` : "No assignments yet"}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Card>
                <EmptyState title="No courses yet" body="Add your courses to see grades, deadlines and progress at a glance." action={<Button size="sm" variant="primary" onClick={() => openForm({ kind: "course" })}>Add a course</Button>} />
              </Card>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
