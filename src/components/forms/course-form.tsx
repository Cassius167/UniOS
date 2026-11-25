"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Modal, toast } from "@/components/ui/overlay";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";
import { uid, nowIso } from "@/lib/ids";
import type { Course, CourseTone, EventType } from "@/lib/types";
import { TONES, EVENT_TYPE_LABEL } from "@/lib/labels";
import { cn, toIso } from "@/lib/utils";
import { addDays, format } from "date-fns";

const num = (label: string, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max), `${label} must be between 0 and ${max}`);

const schema = z.object({
  code: z.string().trim().min(1, "Enter a course code").max(24),
  name: z.string().trim().min(1, "Enter the course name").max(160),
  instructor: z.string().max(120),
  semesterId: z.string(),
  credits: num("Credits", 30),
  targetGrade: num("Target", 100),
  description: z.string().max(4000),
  officeHours: z.string().max(300),
  website: z.string().trim().refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Use a full link starting with https://"),
});
type Values = z.infer<typeof schema>;

interface Meeting {
  key: string;
  type: EventType;
  days: number[];
  start: string;
  end: string;
  location: string;
}

export function CourseForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const existing = useStore((s) => (id ? s.data.courses.find((c) => c.id === id) : undefined));
  const settings = useStore((s) => s.data.settings);
  const { add, update } = useStore.getState();
  const router = useRouter();
  const [tone, setTone] = useState<CourseTone>(existing?.tone ?? "sage");
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: existing?.code ?? "",
      name: existing?.name ?? "",
      instructor: existing?.instructor ?? "",
      semesterId: existing?.semesterId ?? settings.currentSemesterId ?? "",
      credits: existing?.credits?.toString() ?? "3",
      targetGrade: existing?.targetGrade?.toString() ?? "",
      description: existing?.description ?? "",
      officeHours: existing?.officeHours ?? "",
      website: existing?.website ?? "",
    },
  });

  const onSubmit = (v: Values) => {
    const rec = {
      code: v.code.toUpperCase(),
      name: v.name,
      instructor: v.instructor,
      semesterId: v.semesterId || null,
      credits: v.credits === "" ? null : Number(v.credits),
      targetGrade: v.targetGrade === "" ? null : Number(v.targetGrade),
      description: v.description,
      officeHours: v.officeHours,
      website: v.website,
      tone,
    };
    if (existing) {
      update("courses", existing.id, rec);
      toast.success("Course updated");
      onClose();
      return;
    }
    const course: Course = { ...rec, id: uid("crs"), dropRules: [], archived: false, isDemo: false, createdAt: nowIso(), updatedAt: nowIso() };
    add("courses", course);

    // Weekly meetings become recurring calendar events bounded by the semester.
    const sem = settings.semesters.find((s) => s.id === course.semesterId);
    let anchor = sem ? new Date(`${sem.startDate}T00:00:00`) : new Date();
    if (anchor < new Date() && !sem) anchor = new Date();
    for (const m of meetings) {
      if (!m.days.length || !m.start || !m.end || m.end <= m.start) continue;
      let first = anchor;
      while (!m.days.includes(first.getDay())) first = addDays(first, 1);
      const d = format(first, "yyyy-MM-dd");
      add("events", {
        id: uid("evt"),
        title: `${course.code} ${EVENT_TYPE_LABEL[m.type]}`,
        type: m.type,
        courseId: course.id,
        start: toIso(d, m.start),
        end: toIso(d, m.end),
        allDay: false,
        location: m.location,
        description: "",
        recurrence: { freq: "weekly", interval: 1, byWeekday: m.days, until: sem?.endDate ?? null },
        exceptions: [],
        reminderMinutes: 10,
        source: "local",
        externalId: null,
        isDemo: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    toast.success(`${course.code} added`);
    onClose();
    router.push(`/courses/${course.id}`);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? `Edit ${existing.code}` : "New course"}
      eyebrow="My Courses"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)}>
            {existing ? "Save" : "Create course"}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4 md:grid-cols-6" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Course code" error={errors.code?.message} className="col-span-1 md:col-span-2">
          <Input {...register("code")} placeholder="APSC 171" className="num uppercase" data-autofocus />
        </Field>
        <Field label="Course name" error={errors.name?.message} className="col-span-1 md:col-span-4">
          <Input {...register("name")} placeholder="Engineering Calculus I" />
        </Field>
        <Field label="Instructor" className="col-span-2 md:col-span-3">
          <Input {...register("instructor")} placeholder="Professor or instructor" />
        </Field>
        <Field label="Semester" className="col-span-2 md:col-span-3">
          <Select {...register("semesterId")}>
            <option value="">Unassigned</option>
            {settings.semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Credits" error={errors.credits?.message} className="col-span-1 md:col-span-1">
          <Input inputMode="decimal" {...register("credits")} />
        </Field>
        <Field label="Target grade %" error={errors.targetGrade?.message} className="col-span-1 md:col-span-2">
          <Input inputMode="decimal" {...register("targetGrade")} placeholder="80" />
        </Field>
        <div className="col-span-2 md:col-span-3">
          <div className="mb-1.5 text-xs font-medium text-muted">Colour</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TONES) as CourseTone[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-label={t}
                aria-pressed={tone === t}
                onClick={() => setTone(t)}
                className={cn("size-7 rounded-xl border-2", tone === t ? "border-ink" : "border-transparent")}
                style={{ background: TONES[t] }}
              />
            ))}
          </div>
        </div>
        <Field label="Office hours" className="col-span-2 md:col-span-3">
          <Input {...register("officeHours")} placeholder="Wed 14:00–15:30, EME 2nd floor" />
        </Field>
        <Field label="Course website / LMS" error={errors.website?.message} className="col-span-2 md:col-span-3">
          <Input {...register("website")} placeholder="https://canvas.ubc.ca/…" />
        </Field>
        <Field label="Description" className="col-span-2 md:col-span-6">
          <Textarea {...register("description")} />
        </Field>
        <button type="submit" hidden />
      </form>

      {!existing && (
        <div className="mt-6 border-t border-line pt-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-ink">Weekly schedule</div>
              <div className="text-xs text-muted">Each row becomes a recurring calendar event for the semester.</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setMeetings((m) => [...m, { key: uid(), type: "lecture", days: [1, 3], start: "09:00", end: "10:00", location: "" }])}>
              <Plus /> Add meeting
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {meetings.map((m) => {
              const set = (p: Partial<Meeting>) => setMeetings((xs) => xs.map((x) => (x.key === m.key ? { ...x, ...p } : x)));
              return (
                <div key={m.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
                  <select value={m.type} onChange={(e) => set({ type: e.target.value as EventType })} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs" aria-label="Meeting type">
                    {(["lecture", "lab", "tutorial"] as EventType[]).map((t) => (
                      <option key={t} value={t}>
                        {EVENT_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={m.days.includes(i)}
                        onClick={() => set({ days: m.days.includes(i) ? m.days.filter((x) => x !== i) : [...m.days, i].sort() })}
                        className={cn("num size-7 rounded-lg border text-[11px]", m.days.includes(i) ? "border-accent-strong bg-accent-strong text-on-accent-strong" : "border-line-strong text-muted")}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <input type="time" value={m.start} onChange={(e) => set({ start: e.target.value })} className="num h-8 rounded-lg border border-line bg-surface px-2 text-xs" aria-label="Start" />
                  <span className="text-faint">–</span>
                  <input type="time" value={m.end} onChange={(e) => set({ end: e.target.value })} className="num h-8 rounded-lg border border-line bg-surface px-2 text-xs" aria-label="End" />
                  <input value={m.location} onChange={(e) => set({ location: e.target.value })} placeholder="Room" className="h-8 min-w-24 flex-1 rounded-lg border border-line bg-surface px-2 text-xs" aria-label="Location" />
                  <button onClick={() => setMeetings((xs) => xs.filter((x) => x.key !== m.key))} className="text-faint hover:text-terra" aria-label="Remove meeting">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
            {!meetings.length && <p className="text-xs text-faint">No meetings yet. You can also add them later from the calendar.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
