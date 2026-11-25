"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format, isSameDay } from "date-fns";
import { Coffee, Pause, Play, Square, Trash2, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui/primitives";
import { toast, useConfirm } from "@/components/ui/overlay";
import { CourseTag } from "@/components/domain";
import { useStore } from "@/lib/store";
import { useActiveCourses, useCourseMap } from "@/lib/hooks";
import { elapsedMs, useFocus } from "@/lib/focus-store";
import { uid, nowIso } from "@/lib/ids";
import { DISTRACTION_KINDS, type SessionKind } from "@/lib/types";
import { DISTRACTION_LABEL, SESSION_KIND_LABEL } from "@/lib/labels";
import { cn, hours } from "@/lib/utils";

const mmss = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

function useTick(active: boolean) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [active]);
}

function Setup() {
  const params = useSearchParams();
  const focusSettings = useStore((s) => s.data.settings.focus);
  const updateSettings = useStore((s) => s.updateSettings);
  const assignments = useStore((s) => s.data.assignments);
  const courses = useActiveCourses();
  const start = useFocus((s) => s.start);
  const [kind, setKind] = useState<SessionKind>("pomodoro");
  const [custom, setCustom] = useState(40);
  const [courseId, setCourseId] = useState(params.get("course") ?? "");
  const [assignmentId, setAssignmentId] = useState(params.get("assignment") ?? "");
  const [task, setTask] = useState("");
  const minutes = kind === "pomodoro" ? focusSettings.pomodoro : kind === "deep" ? focusSettings.deep : custom;
  const openAsg = assignments.filter((a) => a.status !== "completed" && (!courseId || a.courseId === courseId)).sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="p-6 md:p-8">
        <div className="eyebrow mb-4">Session setup</div>
        <div className="mb-6 grid grid-cols-3 gap-2">
          {(
            [
              ["pomodoro", `${focusSettings.pomodoro} min`, "Pomodoro"],
              ["deep", `${focusSettings.deep} min`, "Deep focus"],
              ["custom", `${custom} min`, "Custom"],
            ] as [SessionKind, string, string][]
          ).map(([k, t, l]) => (
            <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={cn("rounded-[3px] border px-4 py-4 text-left transition-colors", kind === k ? "border-ink bg-ink text-bg" : "border-line-strong hover:border-ink/40")}>
              <div className="num text-2xl">{t}</div>
              <div className={cn("text-xs", kind === k ? "text-bg/70" : "text-muted")}>{l}</div>
            </button>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {kind === "custom" && (
            <Field label="Custom length (minutes)" className="md:col-span-2">
              <Input type="number" min={1} max={240} value={custom} onChange={(e) => setCustom(Math.max(1, Math.min(240, Number(e.target.value) || 1)))} />
            </Field>
          )}
          <Field label="Course">
            <Select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setAssignmentId("");
              }}
            >
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assignment">
            <Select
              value={assignmentId}
              onChange={(e) => {
                setAssignmentId(e.target.value);
                const a = assignments.find((x) => x.id === e.target.value);
                if (a?.courseId) setCourseId(a.courseId);
              }}
            >
              <option value="">None</option>
              {openAsg.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="What will you work on?" className="md:col-span-2">
            <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Questions 5–8, outline section 2" />
          </Field>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            className="h-11 px-6"
            onClick={() => start({ mode: "focus", kind, plannedMinutes: minutes, courseId: courseId || null, assignmentId: assignmentId || null, task: task.trim() || assignments.find((a) => a.id === assignmentId)?.title || "" })}
          >
            <Play /> Start {minutes}-minute session
          </Button>
          <Button onClick={() => start({ mode: "break", kind: "custom", plannedMinutes: focusSettings.shortBreak, courseId: null, assignmentId: null, task: "Short break" })}>
            <Coffee /> Short break · {focusSettings.shortBreak}m
          </Button>
          <Button onClick={() => start({ mode: "break", kind: "custom", plannedMinutes: focusSettings.longBreak, courseId: null, assignmentId: null, task: "Long break" })}>
            <Coffee /> Long break · {focusSettings.longBreak}m
          </Button>
        </div>
      </Card>
      <Card className="self-start p-5">
        <div className="eyebrow mb-3">Durations</div>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["pomodoro", "Pomodoro"],
              ["deep", "Deep focus"],
              ["shortBreak", "Short break"],
              ["longBreak", "Long break"],
            ] as const
          ).map(([k, l]) => (
            <Field key={k} label={`${l} (min)`}>
              <Input type="number" min={1} max={240} value={focusSettings[k]} onChange={(e) => updateSettings({ focus: { ...focusSettings, [k]: Math.max(1, Math.min(240, Number(e.target.value) || 1)) } })} />
            </Field>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">The timer keeps running if you switch pages or close the tab. Paused time is not counted.</p>
      </Card>
    </div>
  );
}

function DistractionLogger() {
  const { distractions, logDistraction, removeDistraction } = useFocus();
  return (
    <div>
      <div className="eyebrow mb-2">Log a distraction</div>
      <div className="flex flex-wrap gap-1.5">
        {DISTRACTION_KINDS.map((k) => (
          <Button key={k} size="sm" onClick={() => logDistraction(k)}>
            {DISTRACTION_LABEL[k]}
          </Button>
        ))}
      </div>
      {distractions.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {distractions.map((d) => (
            <li key={d.id}>
              <Badge tone="outline">
                <span className="num">{format(new Date(d.at), "HH:mm")}</span> {DISTRACTION_LABEL[d.kind]}
                <button onClick={() => removeDistraction(d.id)} aria-label="Remove">
                  <X className="size-2.5" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Running() {
  const f = useFocus();
  const courses = useCourseMap();
  const confirm = useConfirm();
  useTick(f.phase === "running");
  const total = f.plannedMinutes * 60_000;
  const elapsed = elapsedMs(f);
  const remaining = total - elapsed;
  const progress = Math.min(1, elapsed / total);

  useEffect(() => {
    if (f.phase === "running" && remaining <= 0) {
      f.finish();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(f.mode === "break" ? "Break over" : "Session complete", { body: f.task || "Nice work." });
      toast.success(f.mode === "break" ? "Break over. Ready for the next session?" : "Session complete");
    }
  });
  useEffect(() => {
    document.title = `${mmss(remaining)} · ${f.mode === "break" ? "Break" : "Focus"}`;
    return () => {
      document.title = "UniOS";
    };
  });

  const course = f.courseId ? courses.get(f.courseId) : undefined;
  const R = 140;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center py-6">
      <div className="eyebrow mb-2">{f.mode === "break" ? "Break" : SESSION_KIND_LABEL[f.kind]} · {f.plannedMinutes} min</div>
      <div className="mb-8 flex items-center gap-3 text-sm text-muted">
        {course && <CourseTag course={course} />}
        <span className="text-ink">{f.task || "Focused work"}</span>
      </div>
      <div className="relative grid place-items-center">
        <svg width={320} height={320} viewBox="0 0 320 320" className="-rotate-90" aria-hidden>
          <circle cx={160} cy={160} r={R} fill="none" stroke="var(--line)" strokeWidth={2} />
          <circle cx={160} cy={160} r={R} fill="none" stroke={f.mode === "break" ? "var(--ochre)" : "var(--accent)"} strokeWidth={3} strokeDasharray={C} strokeDashoffset={C * (1 - progress)} strokeLinecap="round" style={{ transition: "stroke-dashoffset 250ms linear" }} />
        </svg>
        <div className="absolute text-center">
          <div className="num text-7xl font-light tracking-tight text-ink" role="timer" aria-live="off">
            {mmss(remaining)}
          </div>
          <div className="num mt-2 text-[11px] uppercase tracking-wider text-faint">{f.phase === "paused" ? "Paused" : `${Math.round(progress * 100)}% complete`}</div>
        </div>
      </div>
      <div className="mt-10 flex gap-3">
        {f.phase === "running" ? (
          <Button className="h-11 px-6" onClick={f.pause}>
            <Pause /> Pause
          </Button>
        ) : (
          <Button variant="primary" className="h-11 px-6" onClick={f.resume}>
            <Play /> Resume
          </Button>
        )}
        <Button
          className="h-11 px-6"
          variant="ghost"
          onClick={async () => {
            if (f.mode === "break") return f.discard();
            const mins = Math.round(elapsedMs(f) / 60000);
            if (mins < 1) {
              if (await confirm({ title: "Discard this session?", body: "Less than a minute was recorded, so nothing will be saved.", confirmLabel: "Discard" })) f.discard();
            } else f.finish();
          }}
        >
          <Square /> End {f.mode === "break" ? "break" : "session"}
        </Button>
      </div>
      {f.mode === "focus" && (
        <div className="mt-12 w-full max-w-lg">
          <DistractionLogger />
        </div>
      )}
    </div>
  );
}

function Review() {
  const f = useFocus();
  const add = useStore((s) => s.add);
  const [rating, setRating] = useState<number | null>(null);
  const [reflection, setReflection] = useState("");
  const minutes = Math.round(f.accumulatedMs / 60000);
  const save = () => {
    add("sessions", {
      id: uid("ses"),
      courseId: f.courseId,
      assignmentId: f.assignmentId,
      task: f.task,
      kind: f.kind,
      startedAt: f.startedAt ?? nowIso(),
      plannedMinutes: f.plannedMinutes,
      actualMinutes: Math.max(1, minutes),
      rating,
      reflection: reflection.trim(),
      distractions: f.distractions,
      isDemo: false,
      createdAt: nowIso(),
    });
    toast.success(`Recorded ${hours(Math.max(1, minutes))} of focus`);
    f.discard();
  };
  return (
    <Card className="mx-auto max-w-xl p-6 md:p-8">
      <div className="eyebrow mb-2">Session complete</div>
      <h2 className="font-serif text-4xl text-ink">{hours(Math.max(1, minutes))} focused.</h2>
      <p className="mt-2 text-sm text-muted">{f.task || "Focused work"} · planned {f.plannedMinutes} min</p>
      <div className="mt-6">
        <div className="eyebrow mb-2">How productive was it? (optional)</div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(rating === n ? null : n)} aria-pressed={rating === n} className={cn("num size-10 rounded-[3px] border text-sm", rating !== null && n <= rating ? "border-accent bg-accent text-on-accent" : "border-line-strong text-muted hover:text-ink")}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <Field label="Reflection (optional)" className="mt-5">
        <Textarea value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="What went well? What got in the way?" />
      </Field>
      <div className="mt-5">
        <DistractionLogger />
      </div>
      <div className="mt-8 flex justify-end gap-2">
        <Button variant="ghost" onClick={f.discard}>
          Don’t save
        </Button>
        <Button variant="primary" onClick={save}>
          Save session
        </Button>
      </div>
    </Card>
  );
}

function History() {
  const sessions = useStore((s) => s.data.sessions);
  const remove = useStore((s) => s.remove);
  const courses = useCourseMap();
  const confirm = useConfirm();
  const recent = useMemo(() => [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 12), [sessions]);
  const today = sessions.filter((s) => isSameDay(new Date(s.startedAt), new Date()));
  return (
    <Card className="mt-10">
      <CardHeader eyebrow={`Today: ${today.length} sessions · ${hours(today.reduce((s, x) => s + x.actualMinutes, 0))}`} title="Recent sessions" />
      {recent.length ? (
        <ul className="divide-y divide-line">
          {recent.map((s) => (
            <li key={s.id} className="group grid grid-cols-[100px_1fr_auto_auto] items-center gap-4 px-5 py-2.5 text-sm">
              <span className="num text-xs text-muted">{format(new Date(s.startedAt), "EEE d MMM HH:mm")}</span>
              <span className="flex min-w-0 items-center gap-3">
                <CourseTag course={s.courseId ? courses.get(s.courseId) : null} />
                <span className="truncate text-ink">{s.task || SESSION_KIND_LABEL[s.kind]}</span>
                {s.distractions.length > 0 && <span className="text-[11px] text-terra">{s.distractions.length} distraction{s.distractions.length > 1 ? "s" : ""}</span>}
              </span>
              <span className="num text-xs text-ink">
                {hours(s.actualMinutes)}
                {s.rating ? <span className="ml-2 text-faint">{s.rating}/5</span> : null}
              </span>
              <button
                className="text-faint opacity-0 hover:text-terra group-hover:opacity-100"
                aria-label="Delete session"
                onClick={async () => {
                  if (await confirm({ title: "Delete this session?", body: "It will no longer count in analytics.", confirmLabel: "Delete", destructive: true })) remove("sessions", s.id);
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No sessions yet" body="Completed focus sessions are recorded here and feed your analytics." />
      )}
    </Card>
  );
}

function FocusInner() {
  const phase = useFocus((s) => s.phase);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated) return null;
  return (
    <div className="fade-in">
      <PageHeader index="06 — Focus" title="Focus" subtitle="A quiet timer for deliberate study. Sessions are recorded with their course, task and distractions." />
      {phase === "idle" && <Setup />}
      {(phase === "running" || phase === "paused") && <Running />}
      {phase === "review" && <Review />}
      {phase === "idle" && <History />}
    </div>
  );
}

export default function FocusPage() {
  return (
    <Suspense>
      <FocusInner />
    </Suspense>
  );
}
