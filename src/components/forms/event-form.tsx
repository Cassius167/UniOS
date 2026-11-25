"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Modal, toast, useConfirm } from "@/components/ui/overlay";
import { Button, Field, Input, Segmented, Select, Textarea } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";
import { useActiveCourses } from "@/lib/hooks";
import { uid, nowIso } from "@/lib/ids";
import { EVENT_TYPES, type CalendarEvent, type EventType } from "@/lib/types";
import { EVENT_TYPE_LABEL } from "@/lib/labels";
import { cn, dateInput, timeInput, toIso } from "@/lib/utils";

const schema = z
  .object({
    title: z.string().trim().min(1, "Give the event a title").max(160),
    type: z.enum(EVENT_TYPES),
    courseId: z.string(),
    date: z.string().min(1, "Choose a date"),
    start: z.string(),
    end: z.string(),
    allDay: z.boolean(),
    location: z.string().max(200),
    description: z.string().max(4000),
    repeat: z.enum(["none", "daily", "weekly"]),
    interval: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 52, "Use a whole number from 1 to 52"),
    until: z.string(),
    reminder: z.string(),
  })
  .refine((v) => v.allDay || (v.start && v.end), { path: ["start"], message: "Set a start and end time" })
  .refine((v) => v.allDay || v.end > v.start, { path: ["end"], message: "End time must be after the start time" })
  .refine((v) => v.repeat === "none" || !v.until || v.until >= v.date, { path: ["until"], message: "Must be on or after the first date" });
type Values = z.infer<typeof schema>;

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const REMINDERS = [
  { v: "", l: "No reminder" },
  { v: "0", l: "At start time" },
  { v: "10", l: "10 minutes before" },
  { v: "30", l: "30 minutes before" },
  { v: "60", l: "1 hour before" },
  { v: "1440", l: "1 day before" },
];

export interface EventDefaults {
  courseId?: string | null;
  date?: string;
  start?: string;
  end?: string;
  type?: string;
}

export function EventForm({ id, occurrenceDate, defaults, onClose }: { id?: string; occurrenceDate?: string; defaults?: EventDefaults; onClose: () => void }) {
  const existing = useStore((s) => (id ? s.data.events.find((e) => e.id === id) : undefined));
  const semester = useStore((s) => s.data.settings.semesters.find((x) => x.id === s.data.settings.currentSemesterId));
  const { add, update, remove } = useStore.getState();
  const courses = useActiveCourses();
  const confirm = useConfirm();
  const recurring = !!existing?.recurrence;
  const [scope, setScope] = useState<"one" | "all">(recurring && occurrenceDate ? "one" : "all");
  const [weekdays, setWeekdays] = useState<number[]>(existing?.recurrence?.byWeekday ?? []);

  const startDate = existing ? new Date(existing.start) : null;
  const defaultType = (defaults?.type as EventType) ?? "lecture";
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          title: existing.title,
          type: existing.type,
          courseId: existing.courseId ?? "",
          date: occurrenceDate ?? dateInput(existing.start),
          start: timeInput(existing.start),
          end: timeInput(existing.end),
          allDay: existing.allDay,
          location: existing.location,
          description: existing.description,
          repeat: existing.recurrence?.freq ?? "none",
          interval: String(existing.recurrence?.interval ?? 1),
          until: existing.recurrence?.until ?? "",
          reminder: existing.reminderMinutes === null ? "" : String(existing.reminderMinutes),
        }
      : {
          title: defaultType === "study" ? "Study session" : "",
          type: defaultType,
          courseId: defaults?.courseId ?? "",
          date: defaults?.date ?? format(new Date(), "yyyy-MM-dd"),
          start: defaults?.start ?? "09:00",
          end: defaults?.end ?? "10:00",
          allDay: false,
          location: "",
          description: "",
          repeat: "none",
          interval: "1",
          until: semester?.endDate ?? "",
          reminder: "10",
        },
  });
  const repeat = watch("repeat");
  const allDay = watch("allDay");
  const date = watch("date");
  const editingSeries = recurring && scope === "all";

  const build = (v: Values): Omit<CalendarEvent, "id" | "createdAt" | "updatedAt" | "isDemo" | "exceptions" | "source" | "externalId"> => {
    const startIso = v.allDay ? toIso(v.date, "00:00") : toIso(v.date, v.start);
    const endIso = v.allDay ? toIso(v.date, "23:59") : toIso(v.date, v.end);
    const recurrence =
      v.repeat === "none" || (recurring && scope === "one")
        ? null
        : { freq: v.repeat, interval: Number(v.interval), byWeekday: v.repeat === "weekly" ? (weekdays.length ? weekdays : [new Date(startIso).getDay()]) : [], until: v.until || null };
    return {
      title: v.title,
      type: v.type,
      courseId: v.courseId || null,
      start: startIso,
      end: endIso,
      allDay: v.allDay,
      location: v.location,
      description: v.description,
      recurrence,
      reminderMinutes: v.reminder === "" ? null : Number(v.reminder),
    };
  };

  const onSubmit = (v: Values) => {
    const rec = build(v);
    if (existing && recurring && scope === "one" && occurrenceDate) {
      // Detach this occurrence: skip it in the series and save it as its own event.
      update("events", existing.id, { exceptions: [...existing.exceptions, occurrenceDate] });
      add("events", { ...rec, id: uid("evt"), exceptions: [], source: "local", externalId: null, isDemo: existing.isDemo, createdAt: nowIso(), updatedAt: nowIso() });
      toast.success("Occurrence updated");
    } else if (existing) {
      let patch = rec;
      if (editingSeries && startDate) {
        // Keep the series anchored at its original first date; apply new times.
        const anchor = format(startDate, "yyyy-MM-dd");
        patch = { ...rec, start: v.allDay ? toIso(anchor, "00:00") : toIso(anchor, v.start), end: v.allDay ? toIso(anchor, "23:59") : toIso(anchor, v.end) };
      }
      update("events", existing.id, patch);
      toast.success(editingSeries ? "Series updated" : "Event updated");
    } else {
      add("events", { ...rec, id: uid("evt"), exceptions: [], source: "local", externalId: null, isDemo: false, createdAt: nowIso(), updatedAt: nowIso() });
      toast.success(rec.type === "study" ? "Study session planned" : "Event created");
    }
    onClose();
  };

  const onDelete = async () => {
    if (!existing) return;
    if (recurring && scope === "one" && occurrenceDate) {
      if (await confirm({ title: "Delete this occurrence?", body: `Only ${format(new Date(`${occurrenceDate}T00:00:00`), "EEEE d MMMM")} will be removed. The rest of the series stays.`, confirmLabel: "Delete occurrence", destructive: true })) {
        update("events", existing.id, { exceptions: [...existing.exceptions, occurrenceDate] });
        toast.success("Occurrence deleted");
        onClose();
      }
      return;
    }
    if (await confirm({ title: recurring ? "Delete the whole series?" : "Delete event?", body: `“${existing.title}” will be permanently removed${recurring ? ", including every occurrence" : ""}.`, confirmLabel: "Delete", destructive: true })) {
      remove("events", existing.id);
      toast.success("Event deleted");
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? "Edit event" : defaultType === "study" ? "Plan a study session" : "New event"}
      eyebrow="Calendar"
      footer={
        <>
          {existing && (
            <Button variant="ghost" className="mr-auto text-terra hover:text-terra" onClick={onDelete}>
              <Trash2 /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)}>
            {existing ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      {recurring && occurrenceDate && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-muted">
          <span>This is a recurring event.</span>
          <Segmented
            label="Edit scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: "one", label: "This occurrence" },
              { value: "all", label: "All occurrences" },
            ]}
          />
        </div>
      )}
      <form className="grid grid-cols-2 gap-4 md:grid-cols-6" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Title" error={errors.title?.message} className="col-span-2 md:col-span-6">
          <Input {...register("title")} placeholder="e.g. APSC 171 Lecture" aria-invalid={!!errors.title} data-autofocus />
        </Field>
        <Field label="Type" className="col-span-1 md:col-span-3">
          <Select {...register("type")}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Course" className="col-span-1 md:col-span-3">
          <Select {...register("courseId")}>
            <option value="">None</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={editingSeries ? "Date (series start is kept)" : "Date"} error={errors.date?.message} className="col-span-2 md:col-span-2">
          <Input type="date" {...register("date")} disabled={editingSeries} />
        </Field>
        <Field label="Start" error={errors.start?.message} className="col-span-1 md:col-span-2">
          <Input type="time" {...register("start")} disabled={allDay} />
        </Field>
        <Field label="End" error={errors.end?.message} className="col-span-1 md:col-span-2">
          <Input type="time" {...register("end")} disabled={allDay} />
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-xs text-muted md:col-span-6">
          <input type="checkbox" {...register("allDay")} className="accent-[var(--accent)]" /> All-day
        </label>
        <Field label="Location" className="col-span-2 md:col-span-3">
          <Input {...register("location")} placeholder="Building and room" />
        </Field>
        <Field label="Reminder" className="col-span-2 md:col-span-3">
          <Select {...register("reminder")}>
            {REMINDERS.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </Select>
        </Field>

        {!(recurring && scope === "one") && (
          <div className="col-span-2 grid grid-cols-2 gap-4 rounded-xl border border-line p-4 md:col-span-6 md:grid-cols-6">
            <Field label="Repeat" className="col-span-1 md:col-span-2">
              <Select {...register("repeat")}>
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </Select>
            </Field>
            {repeat !== "none" && (
              <>
                <Field label={`Every N ${repeat === "daily" ? "days" : "weeks"}`} error={errors.interval?.message} className="col-span-1 md:col-span-2">
                  <Input inputMode="numeric" {...register("interval")} />
                </Field>
                <Field label="Until" error={errors.until?.message} className="col-span-2 md:col-span-2" hint={semester ? `Semester ends ${semester.endDate}` : undefined}>
                  <Input type="date" {...register("until")} />
                </Field>
                {repeat === "weekly" && (
                  <div className="col-span-2 md:col-span-6">
                    <div className="mb-1.5 text-xs font-medium text-muted">On</div>
                    <div className="flex gap-1.5">
                      {DAYS.map((d, i) => {
                        const on = weekdays.length ? weekdays.includes(i) : date ? new Date(`${date}T00:00:00`).getDay() === i : false;
                        return (
                          <button
                            key={i}
                            type="button"
                            aria-pressed={on}
                            aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i]}
                            onClick={() => {
                              const base = weekdays.length ? weekdays : date ? [new Date(`${date}T00:00:00`).getDay()] : [];
                              setWeekdays(base.includes(i) ? base.filter((x) => x !== i) : [...base, i].sort());
                            }}
                            className={cn("num size-8 rounded-xl border text-xs", on ? "border-accent-strong bg-accent-strong text-on-accent-strong" : "border-line-strong text-muted hover:text-ink")}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <Field label="Description" className="col-span-2 md:col-span-6">
          <Textarea {...register("description")} placeholder="Agenda, what to bring, links…" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
