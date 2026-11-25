"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, Flag, MapPin, Plus, Repeat, Zap } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, Segmented, Select } from "@/components/ui/primitives";
import { toast } from "@/components/ui/overlay";
import { CourseTag, DueLabel } from "@/components/domain";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useActiveCourses, useCourseMap, useNow } from "@/lib/hooks";
import { expandEvents, moveEvent, type Occurrence } from "@/lib/calendar/recurrence";
import { EVENT_TYPE_LABEL, EVENT_TYPE_TONE, TONES } from "@/lib/labels";
import { EVENT_TYPES, type Assignment, type CalendarEvent } from "@/lib/types";
import { uid, nowIso } from "@/lib/ids";
import { cn, toIso } from "@/lib/utils";

type View = "month" | "week" | "day";
const HOUR = 48; // px per hour in the time grid
const DAY_START = 7;
const DAY_END = 23;

/* ───────── shared data hook ───────── */
function useCalendarData(range: { start: Date; end: Date }, courseFilter: string, typeFilter: string, showDeadlines: boolean) {
  const events = useStore((s) => s.data.events);
  const assignments = useStore((s) => s.data.assignments);
  return useMemo(() => {
    const evs = events.filter((e) => (!courseFilter || e.courseId === courseFilter) && (!typeFilter || e.type === typeFilter));
    const occ = expandEvents(evs, range.start, range.end);
    const deadlines = showDeadlines && (!typeFilter || typeFilter === "deadline") ? assignments.filter((a) => (!courseFilter || a.courseId === courseFilter) && new Date(a.dueAt) >= range.start && new Date(a.dueAt) <= range.end) : [];
    return { occ, deadlines };
  }, [events, assignments, range.start, range.end, courseFilter, typeFilter, showDeadlines]);
}

function toneFor(o: Occurrence, courses: ReturnType<typeof useCourseMap>) {
  const c = o.event.courseId ? courses.get(o.event.courseId) : undefined;
  return c ? TONES[c.tone] : EVENT_TYPE_TONE[o.event.type];
}

/** Drag & drop: moving one occurrence. Recurring occurrences are detached from their series. */
function useMoveOccurrence() {
  const { add, update } = useStore.getState();
  return (event: CalendarEvent, dateKey: string, newStart: Date) => {
    const times = moveEvent(event, newStart); // keeps the event's duration
    if (event.recurrence) {
      update("events", event.id, { exceptions: [...event.exceptions, dateKey] });
      add("events", { ...event, ...times, id: uid("evt"), recurrence: null, exceptions: [], createdAt: nowIso(), updatedAt: nowIso() });
      toast.success("Moved this occurrence");
    } else {
      update("events", event.id, times);
      toast.success("Event moved");
    }
  };
}

/* ───────── Month ───────── */
function MonthView({ cursor, weekStartsOn, data, onPickDay }: { cursor: Date; weekStartsOn: 0 | 1; data: ReturnType<typeof useCalendarData>; onPickDay: (d: Date) => void }) {
  const courses = useCourseMap();
  const openForm = useUI((s) => s.openForm);
  const move = useMoveOccurrence();
  const update = useStore((s) => s.update);
  const [over, setOver] = useState<string | null>(null);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn }) });
  const today = new Date();
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="eyebrow px-3 py-2">
            {format(d, "EEE")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = format(d, "yyyy-MM-dd");
          const occ = data.occ.filter((o) => isSameDay(o.start, d));
          const dl = data.deadlines.filter((a) => isSameDay(new Date(a.dueAt), d));
          const items = [...occ.map((o) => ({ kind: "e" as const, o })), ...dl.map((a) => ({ kind: "d" as const, a }))];
          return (
            <div
              key={key}
              onClick={(e) => e.target === e.currentTarget && openForm({ kind: "event", defaults: { date: key } })}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(key);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const payload = JSON.parse(e.dataTransfer.getData("application/json") || "{}");
                if (payload.kind === "event") {
                  const ev = useStore.getState().data.events.find((x) => x.id === payload.id);
                  if (!ev) return;
                  const s = new Date(payload.start);
                  const ns = new Date(d);
                  ns.setHours(s.getHours(), s.getMinutes(), 0, 0);
                  move(ev, payload.dateKey, ns);
                } else if (payload.kind === "deadline") {
                  const a = useStore.getState().data.assignments.find((x) => x.id === payload.id);
                  if (!a) return;
                  const s = new Date(a.dueAt);
                  const ns = new Date(d);
                  ns.setHours(s.getHours(), s.getMinutes(), 0, 0);
                  update("assignments", a.id, { dueAt: ns.toISOString() });
                  toast.success("Due date moved");
                }
              }}
              className={cn(
                "min-h-28 cursor-pointer border-line p-1.5 transition-colors",
                i % 7 !== 0 && "border-l",
                i >= 7 && "border-t",
                !isSameMonth(d, cursor) && "bg-surface-2/50",
                over === key && "bg-accent-soft",
              )}
            >
              <button onClick={() => onPickDay(d)} className={cn("num mb-1 grid size-6 place-items-center rounded-full text-[11px]", isSameDay(d, today) ? "bg-accent-strong text-on-accent-strong" : isSameMonth(d, cursor) ? "text-ink hover:bg-surface-2" : "text-faint")}>
                {format(d, "d")}
              </button>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((it) =>
                  it.kind === "e" ? (
                    <button
                      key={it.o.key}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify({ kind: "event", id: it.o.event.id, dateKey: it.o.dateKey, start: it.o.start.toISOString() }))}
                      onClick={() => openForm({ kind: "event", id: it.o.event.id, occurrenceDate: it.o.isRecurring ? it.o.dateKey : undefined })}
                      className="flex items-center gap-1.5 truncate rounded-lg px-1 py-0.5 text-left text-[11px] text-ink hover:bg-surface-2"
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: toneFor(it.o, courses) }} />
                      <span className="num text-faint">{it.o.event.allDay ? "" : format(it.o.start, "HH:mm")}</span>
                      <span className="truncate">{it.o.event.title}</span>
                    </button>
                  ) : (
                    <button
                      key={it.a.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify({ kind: "deadline", id: it.a.id }))}
                      onClick={() => openForm({ kind: "assignment", id: it.a.id })}
                      className={cn("flex items-center gap-1.5 truncate rounded-lg px-1 py-0.5 text-left text-[11px] hover:bg-surface-2", it.a.status === "completed" ? "text-faint line-through" : "text-terra")}
                    >
                      <Flag className="size-2.5 shrink-0" />
                      <span className="truncate">{it.a.title}</span>
                    </button>
                  ),
                )}
                {items.length > 3 && (
                  <button onClick={() => onPickDay(d)} className="px-1 text-left text-[10px] text-muted hover:text-ink">
                    +{items.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Week (time grid) ───────── */
function layoutColumns(occ: Occurrence[]) {
  // Greedy column assignment for overlapping events.
  const sorted = [...occ].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const cols: Occurrence[][] = [];
  const pos = new Map<string, { col: number; cols: number }>();
  let cluster: Occurrence[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((o) => pos.get(o.key)!.col + 1));
    cluster.forEach((o) => (pos.get(o.key)!.cols = n));
    cluster = [];
    cols.length = 0;
  };
  for (const o of sorted) {
    if (cluster.length && o.start.getTime() >= clusterEnd) flush();
    let c = cols.findIndex((col) => col[col.length - 1].end <= o.start);
    if (c === -1) {
      c = cols.length;
      cols.push([]);
    }
    cols[c].push(o);
    pos.set(o.key, { col: c, cols: 1 });
    cluster.push(o);
    clusterEnd = Math.max(clusterEnd, o.end.getTime());
  }
  if (cluster.length) flush();
  return pos;
}

function WeekView({ days, data, now }: { days: Date[]; data: ReturnType<typeof useCalendarData>; now: Date }) {
  const courses = useCourseMap();
  const openForm = useUI((s) => s.openForm);
  const move = useMoveOccurrence();
  const scroller = useRef<HTMLDivElement>(null);
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (Math.min(now.getHours(), 17) - DAY_START - 1) * HOUR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slotFromY = (day: Date, y: number) => {
    const minutes = Math.round((y / HOUR) * 60 / 30) * 30 + DAY_START * 60;
    const d = new Date(day);
    d.setHours(0, minutes, 0, 0);
    return d;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
        <div />
        {days.map((d) => {
          const allDay = data.occ.filter((o) => o.event.allDay && isSameDay(o.start, d));
          const dl = data.deadlines.filter((a) => isSameDay(new Date(a.dueAt), d));
          return (
            <div key={d.toISOString()} className="border-l border-line px-2 py-2">
              <div className="flex items-baseline gap-1.5">
                <span className="eyebrow">{format(d, "EEE")}</span>
                <span className={cn("num text-sm", isSameDay(d, now) ? "rounded-full bg-accent-strong px-1.5 text-on-accent-strong" : "text-ink")}>{format(d, "d")}</span>
              </div>
              {[...allDay.map((o) => ({ k: o.key, t: o.event.title, run: () => openForm({ kind: "event", id: o.event.id, occurrenceDate: o.isRecurring ? o.dateKey : undefined }), c: "text-ink" })), ...dl.map((a) => ({ k: a.id, t: a.title, run: () => openForm({ kind: "assignment", id: a.id }), c: a.status === "completed" ? "text-faint line-through" : "text-terra" }))].map((x) => (
                <button key={x.k} onClick={x.run} className={cn("mt-1 flex w-full items-center gap-1 truncate text-left text-[10px]", x.c)}>
                  <Flag className="size-2.5 shrink-0" /> <span className="truncate">{x.t}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div ref={scroller} className="max-h-[68vh] overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
          <div>
            {hours.map((h) => (
              <div key={h} className="num relative text-right text-[10px] text-faint" style={{ height: HOUR }}>
                <span className="absolute -top-1.5 right-2">{String(h).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>
          {days.map((day) => {
            const occ = data.occ.filter((o) => !o.event.allDay && isSameDay(o.start, day));
            const pos = layoutColumns(occ);
            return (
              <div
                key={day.toISOString()}
                className="relative border-l border-line"
                style={{ height: hours.length * HOUR }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const start = slotFromY(day, e.clientY - rect.top - HOUR / 4);
                  openForm({ kind: "event", defaults: { date: format(start, "yyyy-MM-dd"), start: format(start, "HH:mm"), end: format(new Date(start.getTime() + 36e5), "HH:mm") } });
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const payload = JSON.parse(e.dataTransfer.getData("application/json") || "{}");
                  const ev = useStore.getState().data.events.find((x) => x.id === payload.id);
                  if (!ev) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  move(ev, payload.dateKey, slotFromY(day, e.clientY - rect.top - (payload.grabOffset ?? 0)));
                }}
              >
                {hours.map((h) => (
                  <div key={h} className="pointer-events-none border-b border-line/70" style={{ height: HOUR }} />
                ))}
                {isSameDay(day, now) && now.getHours() >= DAY_START && now.getHours() < DAY_END && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-terra" style={{ top: ((now.getHours() - DAY_START) * 60 + now.getMinutes()) * (HOUR / 60) }}>
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-terra" />
                  </div>
                )}
                {occ.map((o) => {
                  const startMin = (o.start.getHours() - DAY_START) * 60 + o.start.getMinutes();
                  const dur = Math.max(20, (o.end.getTime() - o.start.getTime()) / 60000);
                  const p = pos.get(o.key)!;
                  const tone = toneFor(o, courses);
                  const course = o.event.courseId ? courses.get(o.event.courseId) : undefined;
                  return (
                    <button
                      key={o.key}
                      draggable
                      onDragStart={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        e.dataTransfer.setData("application/json", JSON.stringify({ id: o.event.id, dateKey: o.dateKey, grabOffset: e.clientY - rect.top }));
                      }}
                      onClick={() => openForm({ kind: "event", id: o.event.id, occurrenceDate: o.isRecurring ? o.dateKey : undefined })}
                      className="absolute overflow-hidden rounded-xl border border-line bg-surface px-1.5 py-1 text-left transition-shadow hover:z-20 hover:shadow-md"
                      style={{
                        top: Math.max(0, startMin) * (HOUR / 60),
                        height: dur * (HOUR / 60) - 2,
                        left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                        width: `calc(${100 / p.cols}% - 4px)`,
                        borderLeft: `3px solid ${tone}`,
                        background: `color-mix(in srgb, ${tone} 10%, var(--surface))`,
                      }}
                      title={`${o.event.title} · ${format(o.start, "HH:mm")}–${format(o.end, "HH:mm")}`}
                    >
                      <div className="truncate text-[11px] font-medium leading-tight text-ink">{o.event.title}</div>
                      <div className="num truncate text-[10px] text-muted">
                        {format(o.start, "HH:mm")}–{format(o.end, "HH:mm")}
                        {course ? ` · ${course.code}` : ""}
                      </div>
                      {dur >= 60 && o.event.location && <div className="truncate text-[10px] text-faint">{o.event.location}</div>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────── Day agenda ───────── */
function DayView({ day, data, now }: { day: Date; data: ReturnType<typeof useCalendarData>; now: Date }) {
  const courses = useCourseMap();
  const openForm = useUI((s) => s.openForm);
  const occ = data.occ.filter((o) => isSameDay(o.start, day));
  const dl = data.deadlines.filter((a) => isSameDay(new Date(a.dueAt), day));
  const totalMin = occ.filter((o) => !o.event.allDay).reduce((s, o) => s + (o.end.getTime() - o.start.getTime()) / 60000, 0);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card>
        <div className="flex items-end justify-between border-b border-line px-6 py-5">
          <div>
            <div className="eyebrow">{format(day, "EEEE")}</div>
            <div className="font-serif text-4xl text-ink">{format(day, "d MMMM")}</div>
          </div>
          <div className="num text-right text-xs text-muted">
            {occ.length} event{occ.length === 1 ? "" : "s"}
            <div>{Math.round(totalMin / 6) / 10}h scheduled</div>
          </div>
        </div>
        {occ.length ? (
          <ol className="divide-y divide-line/60">
            {occ.map((o) => {
              const course = o.event.courseId ? courses.get(o.event.courseId) : undefined;
              const past = o.end < now;
              return (
                <li key={o.key}>
                  <button onClick={() => openForm({ kind: "event", id: o.event.id, occurrenceDate: o.isRecurring ? o.dateKey : undefined })} className={cn("grid w-full grid-cols-[90px_1fr] gap-5 px-6 py-4 text-left hover:bg-surface-2/60", past && "opacity-55")}>
                    <div className="num text-sm text-ink">
                      {o.event.allDay ? "All day" : format(o.start, "HH:mm")}
                      {!o.event.allDay && <div className="text-[11px] text-faint">to {format(o.end, "HH:mm")}</div>}
                    </div>
                    <div className="border-l-2 pl-4" style={{ borderColor: toneFor(o, courses) }}>
                      <div className="text-[15px] text-ink">{o.event.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <span>{EVENT_TYPE_LABEL[o.event.type]}</span>
                        {course && <span className="num">{course.code}</span>}
                        {o.event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {o.event.location}
                          </span>
                        )}
                        {o.isRecurring && (
                          <span className="flex items-center gap-1">
                            <Repeat className="size-3" /> Repeats
                          </span>
                        )}
                      </div>
                      {o.event.description && <p className="mt-2 text-xs leading-relaxed text-muted">{o.event.description}</p>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState title="Nothing scheduled" body="Click below to add a class, study session or commitment." action={<Button size="sm" onClick={() => openForm({ kind: "event", defaults: { date: format(day, "yyyy-MM-dd") } })}>Add event</Button>} />
        )}
      </Card>
      <Card className="self-start">
        <div className="border-b border-line px-5 py-3.5 text-sm font-semibold text-ink">Due this day</div>
        {dl.length ? (
          <ul className="divide-y divide-line/60">
            {dl.map((a: Assignment) => (
              <li key={a.id}>
                <button onClick={() => openForm({ kind: "assignment", id: a.id })} className="w-full px-5 py-3 text-left hover:bg-surface-2/60">
                  <div className={cn("text-sm", a.status === "completed" ? "text-faint line-through" : "text-ink")}>{a.title}</div>
                  <div className="mt-0.5 flex items-center gap-3">
                    <CourseTag course={a.courseId ? courses.get(a.courseId) : null} />
                    <DueLabel iso={a.dueAt} done={a.status === "completed"} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-xs text-muted">No deadlines.</p>
        )}
      </Card>
    </div>
  );
}

/* ───────── Quick add ───────── */
function QuickAddEvent({ defaultDate }: { defaultDate: Date }) {
  const add = useStore((s) => s.add);
  const courses = useActiveCourses();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(format(defaultDate, "yyyy-MM-dd"));
  const [time, setTime] = useState("14:00");
  const [dur, setDur] = useState("60");
  const [type, setType] = useState<CalendarEvent["type"]>("study");
  const [courseId, setCourseId] = useState("");
  useEffect(() => setDate(format(defaultDate, "yyyy-MM-dd")), [defaultDate]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Add a title first");
    const start = toIso(date, time);
    add("events", {
      id: uid("evt"),
      title: title.trim(),
      type,
      courseId: courseId || null,
      start,
      end: new Date(new Date(start).getTime() + Number(dur) * 60000).toISOString(),
      allDay: false,
      location: "",
      description: "",
      recurrence: null,
      exceptions: [],
      reminderMinutes: 10,
      source: "local",
      externalId: null,
      isDemo: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    toast.success(`Added “${title.trim()}”`);
    setTitle("");
  };
  return (
    <form onSubmit={submit} className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2">
      <Zap className="ml-1.5 size-4 text-faint" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quick add: e.g. Review chapter 5" className="h-8 min-w-40 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none" aria-label="Event title" />
      <select value={type} onChange={(e) => setType(e.target.value as CalendarEvent["type"])} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs" aria-label="Type">
        {EVENT_TYPES.filter((t) => t !== "deadline").map((t) => (
          <option key={t} value={t}>
            {EVENT_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs" aria-label="Course">
        <option value="">No course</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code}
          </option>
        ))}
      </select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="num h-8 rounded-lg border border-line bg-surface px-2 text-xs" aria-label="Date" />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="num h-8 rounded-lg border border-line bg-surface px-2 text-xs" aria-label="Start time" />
      <select value={dur} onChange={(e) => setDur(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs" aria-label="Duration">
        {[30, 45, 60, 90, 120, 180].map((m) => (
          <option key={m} value={m}>
            {m < 60 ? `${m} min` : `${m / 60} h`}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="primary">
        Add
      </Button>
    </form>
  );
}

function CalendarInner() {
  const params = useSearchParams();
  const now = useNow(60_000);
  const weekStartsOn = useStore((s) => s.data.settings.weekStartsOn);
  const courses = useActiveCourses();
  const openForm = useUI((s) => s.openForm);
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(() => (params.get("date") ? new Date(`${params.get("date")}T12:00:00`) : new Date()));
  const [courseFilter, setCourseFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showDeadlines, setShowDeadlines] = useState(true);

  useEffect(() => {
    const d = params.get("date");
    if (d) {
      setCursor(new Date(`${d}T12:00:00`));
      setView("day");
    }
  }, [params]);

  const range = useMemo(() => {
    if (view === "month") return { start: startOfWeek(startOfMonth(cursor), { weekStartsOn }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn }) };
    if (view === "week") return { start: startOfWeek(cursor, { weekStartsOn }), end: endOfWeek(cursor, { weekStartsOn }) };
    return { start: startOfDay(cursor), end: endOfDay(cursor) };
  }, [view, cursor, weekStartsOn]);
  const data = useCalendarData(range, courseFilter, typeFilter, showDeadlines);

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === "month" ? (dir > 0 ? addMonths(c, 1) : subMonths(c, 1)) : view === "week" ? (dir > 0 ? addWeeks(c, 1) : subWeeks(c, 1)) : dir > 0 ? addDays(c, 1) : subDays(c, 1)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || useUI.getState().form) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
      if (e.key.toLowerCase() === "t") setCursor(new Date());
      if (e.key.toLowerCase() === "m") setView("month");
      if (e.key.toLowerCase() === "w") setView("week");
      if (e.key.toLowerCase() === "d") setView("day");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!now) return null;
  const title =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : view === "week"
        ? `${format(range.start, "d MMM")} – ${format(range.end, isSameMonth(range.start, range.end) ? "d" : "d MMM")}${format(range.end, " yyyy")}`
        : format(cursor, "EEEE d MMMM yyyy");

  return (
    <div>
      <PageHeader
       
        title="Calendar"
        subtitle="Classes, exams, study sessions and deadlines. Drag events to reschedule; click an empty slot to add one."
        actions={
          <Button variant="primary" onClick={() => openForm({ kind: "event", defaults: { date: format(cursor, "yyyy-MM-dd") } })}>
            <Plus /> New event
          </Button>
        }
      />
      <QuickAddEvent defaultDate={cursor} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label="Previous">
            <ChevronLeft />
          </Button>
          <Button size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label="Next">
            <ChevronRight />
          </Button>
        </div>
        <h2 className="font-serif text-2xl text-ink md:mr-auto">{title}</h2>
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="h-8 w-auto text-xs" aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 w-auto text-xs" aria-label="Filter by type">
          <option value="">All types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={showDeadlines} onChange={(e) => setShowDeadlines(e.target.checked)} className="accent-[var(--accent)]" /> Deadlines
        </label>
        <Segmented
          label="Calendar view"
          value={view}
          onChange={setView}
          options={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
            { value: "day", label: "Day" },
          ]}
        />
      </div>
      {view === "month" && (
        <MonthView
          cursor={cursor}
          weekStartsOn={weekStartsOn}
          data={data}
          onPickDay={(d) => {
            setCursor(d);
            setView("day");
          }}
        />
      )}
      {view === "week" && <WeekView days={eachDayOfInterval(range)} data={data} now={now} />}
      {view === "day" && <DayView day={cursor} data={data} now={now} />}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarInner />
    </Suspense>
  );
}
