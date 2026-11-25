"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Columns3, List, Plus, Search, Sparkle } from "lucide-react";
import { Button, Card, Checkbox, EmptyState, Input, PageHeader, Progress, Segmented, Select, Tabs } from "@/components/ui/primitives";
import { AssignmentRow, CourseTag, DueLabel, PriorityMark } from "@/components/domain";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useActiveCourses, useCourseMap, useNow } from "@/lib/hooks";
import { attentionLabel, attentionScore, completion } from "@/lib/assignments/priority";
import { ASSIGNMENT_STATUSES, ASSIGNMENT_TYPES, PRIORITIES, type Assignment, type AssignmentStatus } from "@/lib/types";
import { ASSIGNMENT_TYPE_LABEL, PRIORITY_LABEL, STATUS_LABEL, TONES } from "@/lib/labels";
import { cn } from "@/lib/utils";

type View = "all" | "upcoming" | "overdue" | "completed" | "course" | "priority";
type Sort = "due" | "priority" | "attention" | "course" | "title";
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

function SubtaskList({ a }: { a: Assignment }) {
  const update = useStore((s) => s.update);
  const setSub = (id: string, done: boolean) => {
    const subtasks = a.subtasks.map((s) => (s.id === id ? { ...s, done } : s));
    const allDone = subtasks.every((s) => s.done);
    update("assignments", a.id, {
      subtasks,
      status: a.status === "completed" ? (allDone ? "completed" : "in_progress") : subtasks.some((s) => s.done) ? "in_progress" : a.status,
    });
  };
  return (
    <ul className="ml-[52px] mr-5 mb-3 flex flex-col gap-1 border-l border-line pl-4">
      {a.subtasks.map((s) => (
        <li key={s.id} className="flex items-center gap-2.5 py-0.5 text-sm">
          <Checkbox size="sm" checked={s.done} onChange={(v) => setSub(s.id, v)} label={`Mark ${s.title} ${s.done ? "incomplete" : "complete"}`} />
          <span className={cn("flex-1", s.done ? "text-faint line-through" : "text-ink-2")}>{s.title}</span>
          {s.estimatedMinutes ? <span className="num text-[10px] text-faint">{s.estimatedMinutes}m</span> : null}
          {s.dueDate && <span className="num text-[10px] text-faint">{s.dueDate}</span>}
        </li>
      ))}
    </ul>
  );
}

function ListRow({ a, rank }: { a: Assignment; rank?: ReturnType<typeof attentionScore> }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn("ml-2 grid size-6 place-items-center text-faint hover:text-ink", !a.subtasks.length && "invisible")}
          aria-label={open ? "Hide subtasks" : "Show subtasks"}
          aria-expanded={open}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <div className="min-w-0 flex-1 [&>div]:pl-2">
          <AssignmentRow
            a={a}
            extra={
              rank && (
                <span className={cn("text-[11px]", rank.score >= 60 ? "text-terra" : "text-faint")}>
                  {attentionLabel(rank.score)} · {rank.factors.slice(0, 3).map((f) => f.label).join(", ")}
                </span>
              )
            }
          />
        </div>
      </div>
      {open && <SubtaskList a={a} />}
    </div>
  );
}

function Kanban({ items }: { items: Assignment[] }) {
  const update = useStore((s) => s.update);
  const openForm = useUI((s) => s.openForm);
  const courses = useCourseMap();
  const [over, setOver] = useState<AssignmentStatus | null>(null);
  const move = (id: string, status: AssignmentStatus) => {
    const a = items.find((x) => x.id === id);
    if (!a || a.status === status) return;
    update("assignments", id, { status, completedAt: status === "completed" ? new Date().toISOString() : null });
  };
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {ASSIGNMENT_STATUSES.map((status) => {
        const col = items.filter((a) => a.status === status);
        return (
          <section
            key={status}
            aria-label={STATUS_LABEL[status]}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              move(e.dataTransfer.getData("text/plain"), status);
            }}
            className={cn("flex min-h-64 flex-col rounded-2xl border bg-surface-2/40 transition-colors", over === status ? "border-accent bg-accent-soft/40" : "border-line")}
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-medium text-ink">{STATUS_LABEL[status]}</span>
              <span className="num text-xs text-faint">{col.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2 p-2.5">
              {col.map((a) => {
                const p = completion(a);
                const c = a.courseId ? courses.get(a.courseId) : undefined;
                return (
                  <article
                    key={a.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
                    onClick={() => openForm({ kind: "assignment", id: a.id })}
                    onKeyDown={(e) => e.key === "Enter" && openForm({ kind: "assignment", id: a.id })}
                    tabIndex={0}
                    className="cursor-grab rounded-xl border border-line bg-surface p-3 transition-colors hover:border-line-strong active:cursor-grabbing"
                    style={{ borderLeft: `3px solid ${c ? TONES[c.tone] : "var(--line-strong)"}` }}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className={cn("text-sm leading-snug", status === "completed" ? "text-faint line-through" : "text-ink")}>{a.title}</span>
                      <PriorityMark priority={a.priority} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <CourseTag course={c} />
                      <DueLabel iso={a.dueAt} done={status === "completed"} />
                    </div>
                    {a.subtasks.length > 0 && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <Progress value={p} />
                        <span className="num text-[10px] text-faint">
                          {a.subtasks.filter((s) => s.done).length}/{a.subtasks.length}
                        </span>
                      </div>
                    )}
                    {/* Keyboard / touch alternative to drag and drop */}
                    <select
                      value={a.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => move(a.id, e.target.value as AssignmentStatus)}
                      className="mt-2 h-6 w-full rounded-lg border border-line bg-transparent px-1 text-[11px] text-muted md:hidden"
                      aria-label="Move to column"
                    >
                      {ASSIGNMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </article>
                );
              })}
              {!col.length && <p className="px-2 py-6 text-center text-xs text-faint">Drop assignments here</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AssignmentsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const now = useNow(60_000);
  const assignments = useStore((s) => s.data.assignments);
  const openForm = useUI((s) => s.openForm);
  const courses = useActiveCourses();
  const courseMap = useCourseMap();

  const [view, setView] = useState<View>((params.get("view") as View) || "upcoming");
  const [layout, setLayout] = useState<"list" | "board">("list");
  const [q, setQ] = useState("");
  const [course, setCourse] = useState(params.get("course") ?? "");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState<Sort>("due");

  useEffect(() => {
    const id = params.get("open");
    if (id) {
      openForm({ kind: "assignment", id });
      router.replace("/assignments");
    }
  }, [params, openForm, router]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return assignments.filter(
      (a) =>
        (!t || a.title.toLowerCase().includes(t) || a.description.toLowerCase().includes(t)) &&
        (!course || (course === "none" ? !a.courseId : a.courseId === course)) &&
        (!type || a.type === type) &&
        (!priority || a.priority === priority),
    );
  }, [assignments, q, course, type, priority]);

  const scores = useMemo(() => new Map(now ? filtered.map((a) => [a.id, attentionScore(a, now)]) : []), [filtered, now]);

  const viewItems = useMemo(() => {
    if (!now) return [];
    const by: Record<View, (a: Assignment) => boolean> = {
      all: () => true,
      upcoming: (a) => a.status !== "completed" && new Date(a.dueAt) >= now,
      overdue: (a) => a.status !== "completed" && new Date(a.dueAt) < now,
      completed: (a) => a.status === "completed",
      course: () => true,
      priority: (a) => a.status !== "completed",
    };
    const list = filtered.filter(by[view]);
    const s: Sort = view === "priority" ? "attention" : sort;
    const cmp: Record<Sort, (a: Assignment, b: Assignment) => number> = {
      due: (a, b) => (view === "completed" ? b.dueAt.localeCompare(a.dueAt) : a.dueAt.localeCompare(b.dueAt)),
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.dueAt.localeCompare(b.dueAt),
      attention: (a, b) => (scores.get(b.id)?.score ?? 0) - (scores.get(a.id)?.score ?? 0),
      course: (a, b) => (courseMap.get(a.courseId ?? "")?.code ?? "~").localeCompare(courseMap.get(b.courseId ?? "")?.code ?? "~") || a.dueAt.localeCompare(b.dueAt),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return [...list].sort(cmp[s]);
  }, [filtered, view, sort, now, scores, courseMap]);

  if (!now) return null;
  const count = (v: View) =>
    filtered.filter((a) =>
      v === "upcoming" ? a.status !== "completed" && new Date(a.dueAt) >= now : v === "overdue" ? a.status !== "completed" && new Date(a.dueAt) < now : v === "completed" ? a.status === "completed" : true,
    ).length;

  const groups =
    view === "course"
      ? [...courses.map((c) => ({ key: c.id, title: `${c.code} · ${c.name}`, items: viewItems.filter((a) => a.courseId === c.id) })), { key: "none", title: "No course", items: viewItems.filter((a) => !a.courseId || !courseMap.has(a.courseId)) }].filter((g) => g.items.length)
      : [{ key: "all", title: "", items: viewItems }];

  return (
    <div>
      <PageHeader
       
        title="Assignments"
        subtitle={`${count("upcoming")} upcoming · ${count("overdue")} overdue · ${count("completed")} completed`}
        actions={
          <>
            <Segmented
              label="Layout"
              value={layout}
              onChange={setLayout}
              options={[
                { value: "list", label: <span className="flex items-center gap-1.5"><List className="size-3.5" /> List</span> },
                { value: "board", label: <span className="flex items-center gap-1.5"><Columns3 className="size-3.5" /> Board</span> },
              ]}
            />
            <Button variant="primary" onClick={() => openForm({ kind: "assignment", defaults: { courseId: course && course !== "none" ? course : null } })}>
              <Plus /> New assignment
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assignments" className="pl-9" aria-label="Search assignments" />
        </div>
        <Select value={course} onChange={(e) => setCourse(e.target.value)} className="w-auto" aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
          <option value="none">No course</option>
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto" aria-label="Filter by type">
          <option value="">All types</option>
          {ASSIGNMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ASSIGNMENT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-auto" aria-label="Filter by priority">
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
        {layout === "list" && view !== "priority" && (
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto md:ml-auto" aria-label="Sort by">
            <option value="due">Sort: due date</option>
            <option value="attention">Sort: suggested</option>
            <option value="priority">Sort: priority</option>
            <option value="course">Sort: course</option>
            <option value="title">Sort: title</option>
          </Select>
        )}
      </div>

      {layout === "board" ? (
        <Kanban items={filtered} />
      ) : (
        <>
          <Tabs
            value={view}
            onChange={setView}
            tabs={[
              { value: "upcoming", label: "Upcoming", count: count("upcoming") },
              { value: "overdue", label: "Overdue", count: count("overdue") },
              { value: "completed", label: "Completed", count: count("completed") },
              { value: "all", label: "All", count: filtered.length },
              { value: "course", label: "By course" },
              { value: "priority", label: "Suggested order" },
            ]}
          />
          {view === "priority" && (
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Sparkle className="mt-0.5 size-3.5 shrink-0" />
              A suggested order, not a prediction. Each assignment gets an attention score from its deadline proximity, your priority, estimated work left relative to time remaining, open subtasks and grade weight. The main factors are listed on each row.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-6">
            {groups.map((g) => (
              <Card key={g.key}>
                {g.title && (
                  <div className="flex items-center justify-between border-b border-line px-5 py-3">
                    <span className="text-sm font-medium text-ink">{g.title}</span>
                    <span className="num text-xs text-faint">{g.items.length}</span>
                  </div>
                )}
                {g.items.length ? (
                  <div className="divide-y divide-line/60">
                    {g.items.map((a) => (
                      <ListRow key={a.id} a={a} rank={view === "priority" ? scores.get(a.id) : undefined} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={view === "overdue" ? "Nothing overdue" : view === "completed" ? "Nothing completed yet" : q || course || type || priority ? "No assignments match these filters" : "No assignments yet"}
                    body={view === "overdue" ? "You’re caught up." : "Add assignments as they’re announced and break them into steps."}
                    action={view !== "overdue" && view !== "completed" ? <Button size="sm" onClick={() => openForm({ kind: "assignment" })}>Add assignment</Button> : undefined}
                  />
                )}
              </Card>
            ))}
            {!groups.length && (
              <Card>
                <EmptyState title="No assignments yet" action={<Button size="sm" onClick={() => openForm({ kind: "assignment" })}>Add assignment</Button>} />
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AssignmentsPage() {
  return (
    <Suspense>
      <AssignmentsInner />
    </Suspense>
  );
}
