"use client";

/** Small domain-aware building blocks shared across pages. */
import Link from "next/link";
import { format } from "date-fns";
import { MapPin, Repeat } from "lucide-react";
import { Badge, Checkbox, DemoBadge, Progress } from "@/components/ui/primitives";
import { toast } from "@/components/ui/overlay";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useCourseMap } from "@/lib/hooks";
import { completion } from "@/lib/assignments/priority";
import { EVENT_TYPE_LABEL, EVENT_TYPE_TONE, PRIORITY_LABEL, TONES } from "@/lib/labels";
import type { Assignment, Course, Priority } from "@/lib/types";
import type { Occurrence } from "@/lib/calendar/recurrence";
import { cn, hours, relativeDue, urgency } from "@/lib/utils";
import { nowIso } from "@/lib/ids";

export function CourseTag({ course, className }: { course: Course | undefined | null; className?: string }) {
  if (!course) return <span className={cn("text-xs text-faint", className)}>No course</span>;
  return (
    <Link href={`/courses/${course.id}`} onClick={(e) => e.stopPropagation()} className={cn("num inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-ink", className)}>
      <span className="inline-block size-1.5 rounded-full" style={{ background: TONES[course.tone] }} />
      {course.code}
    </Link>
  );
}

export function PriorityMark({ priority }: { priority: Priority }) {
  const tone = priority === "urgent" ? "terra" : priority === "high" ? "ochre" : priority === "medium" ? "neutral" : "outline";
  return <Badge tone={tone}>{PRIORITY_LABEL[priority]}</Badge>;
}

export function DueLabel({ iso, done }: { iso: string; done?: boolean }) {
  const u = urgency(iso);
  return (
    <span className={cn("num whitespace-nowrap text-[11px]", done ? "text-faint" : u === "overdue" ? "text-terra" : u === "today" ? "font-medium text-ink" : "text-muted")}>
      {u === "overdue" && !done ? "Overdue · " : ""}
      {relativeDue(iso)}
    </span>
  );
}

/** Marks an assignment complete/incomplete with an undo toast. */
export function useToggleAssignment() {
  const update = useStore((s) => s.update);
  return (a: Assignment, done: boolean) => {
    const prev = { status: a.status, completedAt: a.completedAt };
    update("assignments", a.id, done ? { status: "completed", completedAt: nowIso() } : { status: a.subtasks.some((s) => s.done) ? "in_progress" : "not_started", completedAt: null });
    if (done) toast.success(`Completed “${a.title}”`, { label: "Undo", run: () => update("assignments", a.id, prev) });
  };
}

export function AssignmentRow({ a, showCourse = true, extra, compact }: { a: Assignment; showCourse?: boolean; extra?: React.ReactNode; compact?: boolean }) {
  const courses = useCourseMap();
  const openForm = useUI((s) => s.openForm);
  const toggle = useToggleAssignment();
  const done = a.status === "completed";
  const pct = completion(a);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openForm({ kind: "assignment", id: a.id })}
      onKeyDown={(e) => e.key === "Enter" && openForm({ kind: "assignment", id: a.id })}
      className={cn("group flex cursor-pointer items-center gap-3 px-5 transition-colors hover:bg-surface-2/60", compact ? "py-2.5" : "py-3")}
    >
      <Checkbox checked={done} onChange={(v) => toggle(a, v)} label={`Mark “${a.title}” ${done ? "incomplete" : "complete"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-sm", done ? "text-faint line-through" : "text-ink")}>{a.title}</span>
          {a.isDemo && <DemoBadge />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {showCourse && <CourseTag course={a.courseId ? courses.get(a.courseId) : null} />}
          <DueLabel iso={a.dueAt} done={done} />
          {a.subtasks.length > 0 && !done && (
            <span className="flex items-center gap-1.5">
              <Progress value={pct} className="w-12" />
              <span className="num text-[10px] text-faint">{Math.round(pct)}%</span>
            </span>
          )}
          {extra}
        </div>
      </div>
      {!compact && <PriorityMark priority={a.priority} />}
    </div>
  );
}

export function OccurrenceRow({ o, now }: { o: Occurrence; now?: Date | null }) {
  const courses = useCourseMap();
  const openForm = useUI((s) => s.openForm);
  const course = o.event.courseId ? courses.get(o.event.courseId) : undefined;
  const live = now && o.start <= now && o.end > now;
  const past = now && o.end <= now;
  const mins = (o.end.getTime() - o.start.getTime()) / 60000;
  return (
    <button
      onClick={() => openForm({ kind: "event", id: o.event.id, occurrenceDate: o.isRecurring ? o.dateKey : undefined })}
      className={cn("group grid w-full grid-cols-[64px_1fr] gap-4 px-5 py-3 text-left transition-colors hover:bg-surface-2/60", past && "opacity-55")}
    >
      <div className="num pt-0.5 text-xs text-ink">
        {o.event.allDay ? "All day" : format(o.start, "HH:mm")}
        {!o.event.allDay && <div className="text-[10px] text-faint">{hours(mins)}</div>}
      </div>
      <div className="min-w-0 border-l-2 pl-3" style={{ borderColor: course ? TONES[course.tone] : EVENT_TYPE_TONE[o.event.type] }}>
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-ink">{o.event.title}</span>
          {live && <Badge tone="sage">Now</Badge>}
          {o.event.isDemo && <DemoBadge />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
          <span>{EVENT_TYPE_LABEL[o.event.type]}</span>
          {course && <span className="num">{course.code}</span>}
          {o.event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" /> {o.event.location}
            </span>
          )}
          {o.isRecurring && <Repeat className="size-3 text-faint" aria-label="Recurring" />}
        </div>
      </div>
    </button>
  );
}
