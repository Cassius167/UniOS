"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, BookOpen, Plus } from "lucide-react";
import { Button, Card, DemoBadge, EmptyState, PageHeader, Progress, Segmented } from "@/components/ui/primitives";
import { DueLabel } from "@/components/domain";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useGradeSummaries } from "@/lib/hooks";
import { bandFor, round } from "@/lib/grades/engine";
import { completion } from "@/lib/assignments/priority";
import { TONES } from "@/lib/labels";

export default function CoursesPage() {
  const courses = useStore((s) => s.data.courses);
  const assignments = useStore((s) => s.data.assignments);
  const settings = useStore((s) => s.data.settings);
  const openForm = useUI((s) => s.openForm);
  const grades = useGradeSummaries();
  const [show, setShow] = useState<"active" | "archived">("active");
  const list = courses.filter((c) => (show === "active" ? !c.archived : c.archived)).sort((a, b) => a.code.localeCompare(b.code));
  const semesterName = (id: string | null) => settings.semesters.find((s) => s.id === id)?.name ?? "No semester";

  return (
    <div>
      <PageHeader
       
        title="My Courses"
        subtitle={`${courses.filter((c) => !c.archived).length} active · ${courses.filter((c) => c.archived).length} archived`}
        actions={
          <>
            <Segmented
              label="Show"
              value={show}
              onChange={setShow}
              options={[
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" },
              ]}
            />
            <Button variant="primary" onClick={() => openForm({ kind: "course" })}>
              <Plus /> New course
            </Button>
          </>
        }
      />
      {list.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const g = grades.get(c.id);
            const open = assignments.filter((a) => a.courseId === c.id && a.status !== "completed").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
            const all = assignments.filter((a) => a.courseId === c.id);
            const prog = all.length ? all.reduce((s, a) => s + completion(a), 0) / all.length : 0;
            const band = bandFor(g?.currentAverage ?? null, settings.gradingScale);
            return (
              <Link key={c.id} href={`/courses/${c.id}`} className="group">
                <Card className="flex h-full flex-col transition-colors group-hover:border-line-strong">
                  <div className="h-1 rounded-t-[4px]" style={{ background: TONES[c.tone] }} />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="num text-xs text-muted">{c.code}</span>
                      {c.isDemo && <DemoBadge />}
                      {c.archived && <Archive className="size-3 text-faint" />}
                    </div>
                    <h2 className="font-serif text-2xl leading-tight text-ink">{c.name}</h2>
                    <p className="mt-1 text-xs text-muted">
                      {c.instructor || "Instructor not set"} · {semesterName(c.semesterId)}
                    </p>
                    <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
                      <div>
                        <div className="eyebrow">Current</div>
                        <div className="num mt-1 text-lg text-ink">{g?.currentAverage === null || !g ? "—" : `${round(g.currentAverage, 1).toFixed(1)}%`}</div>
                        <div className="num text-[10px] text-faint">{band?.label ?? ""}</div>
                      </div>
                      <div>
                        <div className="eyebrow">Open</div>
                        <div className="num mt-1 text-lg text-ink">{open.length}</div>
                        <div className="text-[10px] text-faint">assignments</div>
                      </div>
                      <div>
                        <div className="eyebrow">Graded</div>
                        <div className="num mt-1 text-lg text-ink">{g ? `${Math.round(g.gradedWeight)}%` : "—"}</div>
                        <div className="text-[10px] text-faint">of course</div>
                      </div>
                    </div>
                    <div className="mt-auto pt-5">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate text-muted">{open[0] ? open[0].title : "No upcoming work"}</span>
                        {open[0] && <DueLabel iso={open[0].dueAt} />}
                      </div>
                      <Progress value={prog} />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<BookOpen />}
            title={show === "active" ? "No active courses" : "No archived courses"}
            body={show === "active" ? "Add each course with its schedule, instructor and links. Grades, assignments and notes all hang off it." : "Archive finished courses from their page to keep this list focused."}
            action={show === "active" ? <Button size="sm" variant="primary" onClick={() => openForm({ kind: "course" })}>Add a course</Button> : undefined}
          />
        </Card>
      )}
    </div>
  );
}
