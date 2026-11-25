"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Archive, ArchiveRestore, ArrowLeft, CalendarPlus, Clock, ExternalLink, FileText, ListPlus, Pencil, Percent, Plus, Repeat, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, DemoBadge, EmptyState, Tabs } from "@/components/ui/primitives";
import { toast, useConfirm } from "@/components/ui/overlay";
import { AssignmentRow } from "@/components/domain";
import { ResourceLibrary } from "@/components/resources";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useGradeSummaries, useNow } from "@/lib/hooks";
import { bandFor, requiredForTarget, round } from "@/lib/grades/engine";
import { EVENT_TYPE_LABEL, SESSION_KIND_LABEL, TONES } from "@/lib/labels";
import { cn, hours } from "@/lib/utils";

type Tab = "overview" | "assignments" | "grades" | "notes" | "resources" | "sessions";
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const now = useNow();
  const data = useStore((s) => s.data);
  const { update, removeCourse } = useStore.getState();
  const openForm = useUI((s) => s.openForm);
  const confirm = useConfirm();
  const summaries = useGradeSummaries();
  const [tab, setTab] = useState<Tab>("overview");
  const course = data.courses.find((c) => c.id === id);

  const rel = useMemo(() => {
    const assignments = data.assignments.filter((a) => a.courseId === id).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const assessments = data.assessments.filter((a) => a.courseId === id);
    const notes = data.notes.filter((n) => n.courseId === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const resources = data.resources.filter((r) => r.courseId === id);
    const sessions = data.sessions.filter((s) => s.courseId === id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const schedule = data.events.filter((e) => e.courseId === id && e.recurrence);
    return { assignments, assessments, notes, resources, sessions, schedule };
  }, [data, id]);

  if (!course)
    return (
      <Card>
        <EmptyState title="Course not found" body="It may have been deleted." action={<Button size="sm" onClick={() => router.push("/courses")}>Back to courses</Button>} />
      </Card>
    );
  if (!now) return null;

  const g = summaries.get(course.id);
  const band = bandFor(g?.currentAverage ?? null, data.settings.gradingScale);
  const upcoming = rel.assignments.filter((a) => a.status !== "completed" && new Date(a.dueAt) >= now);
  const studyMin = rel.sessions.reduce((s, x) => s + x.actualMinutes, 0);
  const activity = [
    ...rel.assignments.filter((a) => a.completedAt).map((a) => ({ at: a.completedAt!, text: `Completed “${a.title}”` })),
    ...rel.assessments.filter((a) => a.score !== null).map((a) => ({ at: a.updatedAt, text: `Grade recorded: ${a.name} (${round((a.score! / a.maxScore) * 100, 1)}%)` })),
    ...rel.sessions.map((s) => ({ at: s.startedAt, text: `Studied ${hours(s.actualMinutes)}${s.task ? ` · ${s.task}` : ""}` })),
    ...rel.notes.map((n) => ({ at: n.updatedAt, text: `Edited note “${n.title || "Untitled"}”` })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const onDelete = async () => {
    if (
      await confirm({
        title: `Delete ${course.code}?`,
        body: `This permanently removes the course with its ${rel.assignments.length} assignments, ${rel.assessments.length} grades, ${rel.schedule.length} recurring events and ${rel.resources.length} resources. Notes and study history are kept but unlinked. Consider archiving instead.`,
        confirmLabel: "Delete course",
        destructive: true,
      })
    ) {
      removeCourse(course.id);
      toast.success(`${course.code} deleted`);
      router.push("/courses");
    }
  };

  return (
    <div className="fade-in">
      <Link href="/courses" className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> My Courses
      </Link>
      <header className="mb-8 grid gap-6 border-b border-line pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className="h-4 w-1 rounded-full" style={{ background: TONES[course.tone] }} />
            <span className="num text-sm text-muted">{course.code}</span>
            {course.isDemo && <DemoBadge />}
            {course.archived && <span className="text-xs text-faint">Archived</span>}
          </div>
          <h1 className="font-serif text-4xl leading-none tracking-tight text-ink md:text-5xl">{course.name}</h1>
          <p className="mt-3 text-sm text-muted">
            {course.instructor || "Instructor not set"}
            {course.credits ? ` · ${course.credits} credits` : ""}
            {course.website && (
              <>
                {" · "}
                <a href={course.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink underline underline-offset-2">
                  Course site <ExternalLink className="size-3" />
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => openForm({ kind: "course", id: course.id })}>
            <Pencil /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              update("courses", course.id, { archived: !course.archived });
              toast.success(course.archived ? "Course restored" : "Course archived");
            }}
          >
            {course.archived ? <ArchiveRestore /> : <Archive />} {course.archived ? "Restore" : "Archive"}
          </Button>
          <Button size="sm" variant="ghost" className="text-terra hover:text-terra" onClick={onDelete}>
            <Trash2 /> Delete
          </Button>
        </div>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "assignments", label: "Assignments", count: rel.assignments.length },
          { value: "grades", label: "Grades", count: rel.assessments.length },
          { value: "notes", label: "Notes", count: rel.notes.length },
          { value: "resources", label: "Resources", count: rel.resources.length },
          { value: "sessions", label: "Study sessions", count: rel.sessions.length },
        ]}
      />

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-4">
              <CardHeader eyebrow="Standing" title="Current grade" action={<Link href={`/grades?course=${course.id}`} className="text-xs text-muted hover:text-ink">Grade Tracker</Link>} />
              <div className="px-5 py-5">
                <div className="num text-5xl font-light text-ink">{g?.currentAverage === null || !g ? "—" : `${round(g.currentAverage, 1).toFixed(1)}%`}</div>
                <div className="mt-1 text-xs text-muted">{band ? `${band.label} · average on completed work` : "No grades yet"}</div>
                {g && g.currentAverage !== null && (
                  <dl className="mt-5 grid grid-cols-2 gap-y-3 border-t border-line pt-4 text-xs">
                    <dt className="text-muted">Earned so far</dt>
                    <dd className="num text-right text-ink">{round(g.earnedPercent, 2)}%</dd>
                    <dt className="text-muted">Weight remaining</dt>
                    <dd className="num text-right text-ink">{round(g.openWeight, 2)}%</dd>
                    {course.targetGrade && (
                      <>
                        <dt className="text-muted">Needed for {course.targetGrade}%</dt>
                        <dd className="num text-right text-ink">
                          {(() => {
                            const r = requiredForTarget(g, course.targetGrade);
                            return r.status === "secured" ? "Secured" : r.status === "impossible" ? "Not possible" : r.required === null ? "—" : `${round(r.required, 1)}% avg`;
                          })()}
                        </dd>
                      </>
                    )}
                  </dl>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-8">
              <CardHeader eyebrow="Next up" title="Upcoming deadlines" action={<Button size="sm" variant="ghost" onClick={() => openForm({ kind: "assignment", defaults: { courseId: course.id } })}><ListPlus /> Add</Button>} />
              {upcoming.length ? (
                <div className="divide-y divide-line">
                  {upcoming.slice(0, 5).map((a) => (
                    <AssignmentRow key={a.id} a={a} showCourse={false} compact />
                  ))}
                </div>
              ) : (
                <EmptyState title="No upcoming deadlines" />
              )}
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader eyebrow="Course information" title="Details" />
              <dl className="flex flex-col gap-4 px-5 py-4 text-sm">
                <div>
                  <dt className="eyebrow mb-1">Semester</dt>
                  <dd className="text-ink">{data.settings.semesters.find((s) => s.id === course.semesterId)?.name ?? "Unassigned"}</dd>
                </div>
                <div>
                  <dt className="eyebrow mb-1">Office hours</dt>
                  <dd className="text-ink">{course.officeHours || <span className="text-faint">Not set</span>}</dd>
                </div>
                {course.description && (
                  <div>
                    <dt className="eyebrow mb-1">Description</dt>
                    <dd className="leading-relaxed text-muted">{course.description}</dd>
                  </div>
                )}
                <div>
                  <dt className="eyebrow mb-1.5 flex items-center justify-between">
                    Weekly schedule
                    <button onClick={() => openForm({ kind: "event", defaults: { courseId: course.id, type: "lecture" } })} className="flex items-center gap-1 normal-case tracking-normal text-muted hover:text-ink">
                      <CalendarPlus className="size-3" /> Add
                    </button>
                  </dt>
                  <dd>
                    {rel.schedule.length ? (
                      <ul className="flex flex-col gap-1.5">
                        {rel.schedule.map((e) => (
                          <li key={e.id}>
                            <button onClick={() => openForm({ kind: "event", id: e.id })} className="flex w-full items-baseline gap-2 text-left text-xs hover:text-ink">
                              <Repeat className="size-3 shrink-0 text-faint" />
                              <span className="w-16 shrink-0 text-muted">{EVENT_TYPE_LABEL[e.type]}</span>
                              <span className="num text-ink">
                                {e.recurrence!.byWeekday.map((d) => DAY[d]).join(" ")} {format(new Date(e.start), "HH:mm")}–{format(new Date(e.end), "HH:mm")}
                              </span>
                              {e.location && <span className="truncate text-faint">{e.location}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-faint">No recurring classes yet.</span>
                    )}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader eyebrow="Latest" title="Recent notes" action={<Button size="sm" variant="ghost" onClick={() => openForm({ kind: "note", defaults: { courseId: course.id } })}><Plus /> New</Button>} />
              {rel.notes.length ? (
                <ul className="divide-y divide-line">
                  {rel.notes.slice(0, 4).map((n) => (
                    <li key={n.id}>
                      <Link href={`/notes?note=${n.id}`} className="block px-5 py-3 hover:bg-surface-2/60">
                        <div className="truncate text-sm text-ink">{n.title || "Untitled note"}</div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted">{strip(n.content) || "Empty"}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<FileText />} title="No notes for this course" />
              )}
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader eyebrow={`${hours(studyMin)} studied in total`} title="Recent activity" />
              {activity.length ? (
                <ol className="flex flex-col gap-3 px-5 py-4">
                  {activity.map((a, i) => (
                    <li key={i} className="grid grid-cols-[52px_1fr] gap-3 text-xs">
                      <span className="num text-faint">{format(new Date(a.at), "d MMM")}</span>
                      <span className="text-ink-2">{a.text}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState title="No activity yet" />
              )}
            </Card>
          </div>
        )}

        {tab === "assignments" && (
          <Card>
            <CardHeader title="All assignments" action={<Button size="sm" onClick={() => openForm({ kind: "assignment", defaults: { courseId: course.id } })}><Plus /> New</Button>} />
            {rel.assignments.length ? (
              <div className="divide-y divide-line">
                {rel.assignments.map((a) => (
                  <AssignmentRow key={a.id} a={a} showCourse={false} />
                ))}
              </div>
            ) : (
              <EmptyState title="No assignments for this course" action={<Button size="sm" onClick={() => openForm({ kind: "assignment", defaults: { courseId: course.id } })}>Add assignment</Button>} />
            )}
          </Card>
        )}

        {tab === "grades" && (
          <Card>
            <CardHeader
              title="Grading structure"
              eyebrow={g ? `${round(g.structureWeight, 2)}% defined · ${round(g.gradedWeight, 2)}% graded` : undefined}
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openForm({ kind: "assessment", defaults: { courseId: course.id } })}>
                    <Plus /> Add
                  </Button>
                  <Button size="sm" onClick={() => router.push(`/grades?course=${course.id}`)}>
                    <Percent /> Open Grade Tracker
                  </Button>
                </div>
              }
            />
            {g && g.items.length ? (
              <ul className="divide-y divide-line">
                {g.items.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => openForm({ kind: "assessment", id: r.id })} className="grid w-full grid-cols-[1fr_70px_80px] items-center gap-3 px-5 py-2.5 text-left text-sm hover:bg-surface-2/60">
                      <span className={cn("text-ink", r.dropped && "text-faint line-through")}>{r.name}</span>
                      <span className="num text-right text-muted">{round(r.effectiveWeight, 2)}%</span>
                      <span className="num text-right text-ink">{r.percent === null ? <span className="text-faint">—</span> : `${round(r.percent, 1)}%`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No assessments yet" body="Copy the grading breakdown from your syllabus." action={<Button size="sm" onClick={() => openForm({ kind: "assessment", defaults: { courseId: course.id } })}>Add assessment</Button>} />
            )}
          </Card>
        )}

        {tab === "notes" && (
          <Card>
            <CardHeader title="Course notes" action={<Button size="sm" onClick={() => openForm({ kind: "note", defaults: { courseId: course.id } })}><Plus /> New note</Button>} />
            {rel.notes.length ? (
              <ul className="divide-y divide-line">
                {rel.notes.map((n) => (
                  <li key={n.id}>
                    <Link href={`/notes?note=${n.id}`} className="flex items-baseline gap-4 px-5 py-3 hover:bg-surface-2/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{n.title || "Untitled note"}</span>
                        <span className="line-clamp-1 text-xs text-muted">{strip(n.content)}</span>
                      </span>
                      <span className="num text-[11px] text-faint">{format(new Date(n.updatedAt), "d MMM")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<FileText />} title="No notes yet" action={<Button size="sm" onClick={() => openForm({ kind: "note", defaults: { courseId: course.id } })}>Write a note</Button>} />
            )}
          </Card>
        )}

        {tab === "resources" && <ResourceLibrary courseId={course.id} />}

        {tab === "sessions" && (
          <Card>
            <CardHeader
              eyebrow={`${rel.sessions.length} sessions · ${hours(studyMin)}`}
              title="Study sessions"
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openForm({ kind: "study", defaults: { courseId: course.id } })}>
                    <CalendarPlus /> Plan
                  </Button>
                  <Button size="sm" onClick={() => router.push(`/focus?course=${course.id}`)}>
                    <Clock /> Start focus session
                  </Button>
                </div>
              }
            />
            {rel.sessions.length ? (
              <ul className="divide-y divide-line">
                {rel.sessions.map((s) => (
                  <li key={s.id} className="grid grid-cols-[90px_1fr_auto] items-center gap-4 px-5 py-2.5 text-sm">
                    <span className="num text-xs text-muted">{format(new Date(s.startedAt), "d MMM HH:mm")}</span>
                    <span className="truncate text-ink">
                      {s.task || SESSION_KIND_LABEL[s.kind]}
                      {s.reflection && <span className="ml-2 text-xs text-muted">“{s.reflection}”</span>}
                    </span>
                    <span className="num text-xs text-ink">
                      {hours(s.actualMinutes)}
                      {s.rating ? <span className="ml-2 text-faint">{"●".repeat(s.rating)}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No study sessions yet" body="Use Focus to time a session for this course. It will be recorded here." />
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
