"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays, format } from "date-fns";
import { GripVertical, Plus, Trash2, Wand2 } from "lucide-react";
import { Modal, toast, useConfirm } from "@/components/ui/overlay";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";
import { useActiveCourses } from "@/lib/hooks";
import { uid, nowIso } from "@/lib/ids";
import { ASSIGNMENT_STATUSES, ASSIGNMENT_TYPES, PRIORITIES, SUBMISSION_STATUSES, type Assignment, type AssignmentType, type Subtask } from "@/lib/types";
import { ASSIGNMENT_TYPE_LABEL, PRIORITY_LABEL, STATUS_LABEL, SUBMISSION_LABEL } from "@/lib/labels";
import { dateInput, timeInput, toIso } from "@/lib/utils";

const optionalNumber = (label: string, max?: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), `${label} must be a positive number`)
    .refine((v) => v === "" || max === undefined || Number(v) <= max, `${label} must be at most ${max}`);

const schema = z.object({
  title: z.string().trim().min(1, "Give the assignment a title").max(160),
  courseId: z.string(),
  description: z.string().max(4000),
  dueDate: z.string().min(1, "Choose a due date"),
  dueTime: z.string().min(1, "Choose a due time"),
  type: z.enum(ASSIGNMENT_TYPES),
  estimatedHours: optionalNumber("Estimated workload", 500),
  priority: z.enum(PRIORITIES),
  gradeWeight: optionalNumber("Grade weight", 100),
  status: z.enum(ASSIGNMENT_STATUSES),
  submission: z.enum(SUBMISSION_STATUSES),
});
type Values = z.infer<typeof schema>;

/** Starter breakdowns the student can insert and then edit. */
const TEMPLATES: Partial<Record<AssignmentType, string[]>> = {
  report: ["Understand assignment requirements", "Conduct research", "Find academic sources", "Evaluate sources", "Create outline", "Write first draft", "Revise and edit", "Complete references", "Final review", "Submit"],
  essay: ["Understand the prompt", "Research and gather sources", "Thesis and outline", "Write first draft", "Revise", "Proofread and format", "Submit"],
  lab: ["Review lab manual", "Process data", "Create figures and tables", "Write discussion", "Format and submit"],
  project: ["Define scope and requirements", "Plan milestones", "Build / design", "Test and iterate", "Documentation", "Submit"],
  presentation: ["Outline key messages", "Create slides", "Write speaker notes", "Rehearse", "Final run-through"],
  homework: ["Read the problems", "Solve", "Check answers", "Submit"],
  quiz: ["Review lecture notes", "Practice questions"],
  exam: ["Gather past papers", "Review weak topics", "Practice under timed conditions", "Final review"],
};

export function AssignmentForm({ id, defaults, onClose }: { id?: string; defaults?: { courseId?: string | null; dueDate?: string }; onClose: () => void }) {
  const existing = useStore((s) => (id ? s.data.assignments.find((a) => a.id === id) : undefined));
  const add = useStore((s) => s.add);
  const update = useStore((s) => s.update);
  const remove = useStore((s) => s.remove);
  const courses = useActiveCourses();
  const confirm = useConfirm();

  const [subtasks, setSubtasks] = useState<Subtask[]>(existing?.subtasks ?? []);
  const [newSub, setNewSub] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          title: existing.title,
          courseId: existing.courseId ?? "",
          description: existing.description,
          dueDate: dateInput(existing.dueAt),
          dueTime: timeInput(existing.dueAt),
          type: existing.type,
          estimatedHours: existing.estimatedHours?.toString() ?? "",
          priority: existing.priority,
          gradeWeight: existing.gradeWeight?.toString() ?? "",
          status: existing.status,
          submission: existing.submission,
        }
      : {
          title: "",
          courseId: defaults?.courseId ?? "",
          description: "",
          dueDate: defaults?.dueDate ?? format(addDays(new Date(), 7), "yyyy-MM-dd"),
          dueTime: "23:59",
          type: "homework",
          estimatedHours: "",
          priority: "medium",
          gradeWeight: "",
          status: "not_started",
          submission: "not_submitted",
        },
  });
  const type = watch("type");

  const addSub = (title: string) => {
    const t = title.trim();
    if (!t) return;
    setSubtasks((s) => [...s, { id: uid("sub"), title: t, done: false, dueDate: null, priority: "medium", estimatedMinutes: null }]);
  };

  const onSubmit = (v: Values) => {
    const record: Omit<Assignment, "id" | "createdAt" | "updatedAt" | "isDemo" | "completedAt"> = {
      title: v.title,
      courseId: v.courseId || null,
      description: v.description,
      dueAt: toIso(v.dueDate, v.dueTime),
      type: v.type,
      estimatedHours: v.estimatedHours === "" ? null : Number(v.estimatedHours),
      priority: v.priority,
      gradeWeight: v.gradeWeight === "" ? null : Number(v.gradeWeight),
      status: v.status,
      submission: v.submission,
      subtasks,
    };
    const completedAt = v.status === "completed" ? (existing?.completedAt ?? nowIso()) : null;
    if (existing) {
      update("assignments", existing.id, { ...record, completedAt });
      toast.success("Assignment updated");
    } else {
      add("assignments", { ...record, id: uid("asg"), completedAt, isDemo: false, createdAt: nowIso(), updatedAt: nowIso() });
      toast.success("Assignment created");
    }
    onClose();
  };

  const onDelete = async () => {
    if (!existing) return;
    if (await confirm({ title: "Delete assignment?", body: `“${existing.title}” and its subtasks will be permanently removed.`, confirmLabel: "Delete", destructive: true })) {
      remove("assignments", existing.id);
      toast.success("Assignment deleted");
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? "Edit assignment" : "New assignment"}
      eyebrow="Assignments"
      size="lg"
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
          <Button variant="primary" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {existing ? "Save changes" : "Create assignment"}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4 md:grid-cols-6" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Title" error={errors.title?.message} className="md:col-span-6">
          <Input {...register("title")} placeholder="e.g. Sustainable Engineering Research Report" aria-invalid={!!errors.title} data-autofocus />
        </Field>
        <Field label="Course" className="md:col-span-3">
          <Select {...register("courseId")}>
            <option value="">No course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type" className="md:col-span-3">
          <Select {...register("type")}>
            {ASSIGNMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSIGNMENT_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" error={errors.dueDate?.message} className="md:col-span-2">
          <Input type="date" {...register("dueDate")} aria-invalid={!!errors.dueDate} />
        </Field>
        <Field label="Due time" error={errors.dueTime?.message} className="md:col-span-2">
          <Input type="time" {...register("dueTime")} />
        </Field>
        <Field label="Priority" className="md:col-span-2">
          <Select {...register("priority")}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estimated workload (hours)" error={errors.estimatedHours?.message} className="md:col-span-2">
          <Input inputMode="decimal" {...register("estimatedHours")} placeholder="e.g. 6" />
        </Field>
        <Field label="Grade weight (%)" error={errors.gradeWeight?.message} className="md:col-span-2" hint="Share of the course grade">
          <Input inputMode="decimal" {...register("gradeWeight")} placeholder="e.g. 15" />
        </Field>
        <Field label="Status" className="md:col-span-1">
          <Select {...register("status")}>
            {ASSIGNMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Submission" className="md:col-span-1">
          <Select {...register("submission")}>
            {SUBMISSION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SUBMISSION_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" className="md:col-span-6">
          <Textarea {...register("description")} placeholder="Requirements, rubric notes, links…" />
        </Field>
        <button type="submit" hidden />
      </form>

      <div className="mt-6 border-t border-line pt-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Breakdown</div>
            <div className="text-xs text-muted">Split the work into smaller steps. Progress is calculated from these.</div>
          </div>
          {TEMPLATES[type] && (
            <Button size="sm" variant="ghost" onClick={() => TEMPLATES[type]!.forEach(addSub)}>
              <Wand2 /> Insert {ASSIGNMENT_TYPE_LABEL[type].toLowerCase()} steps
            </Button>
          )}
        </div>
        <ul className="flex flex-col divide-y divide-line rounded-[3px] border border-line">
          {subtasks.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-1.5">
              <GripVertical className="size-3.5 text-faint" />
              <Checkbox size="sm" checked={s.done} label={`Mark ${s.title} complete`} onChange={(done) => setSubtasks((xs) => xs.map((x) => (x.id === s.id ? { ...x, done } : x)))} />
              <input
                value={s.title}
                onChange={(e) => setSubtasks((xs) => xs.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                className="h-7 flex-1 bg-transparent text-sm text-ink focus:outline-none"
                aria-label={`Subtask ${i + 1}`}
              />
              <input
                type="number"
                min={0}
                value={s.estimatedMinutes ?? ""}
                onChange={(e) => setSubtasks((xs) => xs.map((x) => (x.id === s.id ? { ...x, estimatedMinutes: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) } : x)))}
                placeholder="min"
                className="num h-7 w-14 rounded-[2px] border border-line bg-transparent px-1.5 text-xs text-ink"
                aria-label="Estimated minutes"
              />
              <input
                type="date"
                value={s.dueDate ?? ""}
                onChange={(e) => setSubtasks((xs) => xs.map((x) => (x.id === s.id ? { ...x, dueDate: e.target.value || null } : x)))}
                className="num hidden h-7 rounded-[2px] border border-line bg-transparent px-1.5 text-xs text-ink sm:block"
                aria-label="Subtask due date"
              />
              <select
                value={s.priority}
                onChange={(e) => setSubtasks((xs) => xs.map((x) => (x.id === s.id ? { ...x, priority: e.target.value as Subtask["priority"] } : x)))}
                className="h-7 rounded-[2px] border border-line bg-transparent px-1 text-xs text-ink"
                aria-label="Subtask priority"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
              <button onClick={() => setSubtasks((xs) => xs.filter((x) => x.id !== s.id))} className="text-faint hover:text-terra" aria-label="Remove subtask">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
          <li className="flex items-center gap-2 px-3 py-1.5">
            <Plus className="size-3.5 text-faint" />
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSub(newSub);
                  setNewSub("");
                }
              }}
              placeholder="Add a step and press Enter"
              className="h-7 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
              aria-label="New subtask"
            />
          </li>
        </ul>
      </div>
    </Modal>
  );
}
