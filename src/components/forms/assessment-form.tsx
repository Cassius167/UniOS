"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { Modal, toast, useConfirm } from "@/components/ui/overlay";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";
import { useActiveCourses } from "@/lib/hooks";
import { uid, nowIso } from "@/lib/ids";
import { toPercent, round } from "@/lib/grades/engine";

const schema = z
  .object({
    courseId: z.string().min(1, "Choose a course"),
    name: z.string().trim().min(1, "Name the assessment").max(120),
    category: z.string().trim().max(60),
    weight: z.string().refine((v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100, "Weight must be between 0 and 100"),
    score: z.string().refine((v) => v.trim() === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "Score must be 0 or more (leave empty if not graded)"),
    maxScore: z.string().refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, "Maximum must be greater than 0"),
    date: z.string(),
    kind: z.enum(["regular", "bonus", "excused"]),
  })
  .refine((v) => v.score.trim() === "" || Number(v.score) <= Number(v.maxScore) * 2, { path: ["score"], message: "Score is more than double the maximum — check the numbers" });
type Values = z.infer<typeof schema>;

export function AssessmentForm({ id, defaults, onClose }: { id?: string; defaults?: { courseId?: string }; onClose: () => void }) {
  const existing = useStore((s) => (id ? s.data.assessments.find((a) => a.id === id) : undefined));
  const { add, update, remove } = useStore.getState();
  const courses = useActiveCourses();
  const confirm = useConfirm();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: existing?.courseId ?? defaults?.courseId ?? courses[0]?.id ?? "",
      name: existing?.name ?? "",
      category: existing?.category ?? "",
      weight: existing?.weight?.toString() ?? "",
      score: existing?.score?.toString() ?? "",
      maxScore: existing?.maxScore?.toString() ?? "100",
      date: existing?.date ?? "",
      kind: existing?.excused ? "excused" : existing?.isBonus ? "bonus" : "regular",
    },
  });
  const score = watch("score");
  const max = watch("maxScore");
  const preview = score.trim() !== "" && Number(max) > 0 ? toPercent(Number(score), Number(max)) : null;

  const onSubmit = (v: Values) => {
    const rec = {
      courseId: v.courseId,
      name: v.name,
      category: v.category || v.name,
      weight: Number(v.weight),
      score: v.score.trim() === "" ? null : Number(v.score),
      maxScore: Number(v.maxScore),
      date: v.date || null,
      isBonus: v.kind === "bonus",
      excused: v.kind === "excused",
    };
    if (existing) {
      update("assessments", existing.id, rec);
      toast.success("Assessment updated");
    } else {
      add("assessments", { ...rec, id: uid("asm"), isDemo: false, createdAt: nowIso(), updatedAt: nowIso() });
      toast.success("Assessment added");
    }
    onClose();
  };

  const onDelete = async () => {
    if (!existing) return;
    if (await confirm({ title: "Delete assessment?", body: `“${existing.name}” will be removed from the grading structure.`, confirmLabel: "Delete", destructive: true })) {
      remove("assessments", existing.id);
      toast.success("Assessment deleted");
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? "Edit assessment" : "Add assessment"}
      eyebrow="Grade Tracker"
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
            {existing ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4 md:grid-cols-6" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Course" error={errors.courseId?.message} className="col-span-2 md:col-span-6">
          <Select {...register("courseId")}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assessment name" error={errors.name?.message} className="col-span-2 md:col-span-4">
          <Input {...register("name")} placeholder="Midterm 1" data-autofocus />
        </Field>
        <Field label="Weight (% of course)" error={errors.weight?.message} className="col-span-2 md:col-span-2">
          <Input inputMode="decimal" {...register("weight")} placeholder="15" />
        </Field>
        <Field label="Score achieved" error={errors.score?.message} className="col-span-1 md:col-span-2" hint="Leave empty if not graded yet">
          <Input inputMode="decimal" {...register("score")} placeholder="—" />
        </Field>
        <Field label="Out of" error={errors.maxScore?.message} className="col-span-1 md:col-span-2" hint="100 to enter a percentage">
          <Input inputMode="decimal" {...register("maxScore")} />
        </Field>
        <div className="col-span-2 flex flex-col justify-center md:col-span-2">
          <span className="eyebrow">As percentage</span>
          <span className="num text-xl text-ink">{preview === null || !Number.isFinite(preview) ? "Not graded" : `${round(preview, 2)}%`}</span>
          {score.trim() === "" && (
            <button type="button" className="mt-1 self-start text-[11px] text-muted underline underline-offset-2 hover:text-ink" onClick={() => setValue("score", "0")}>
              Mark as zero (missed)
            </button>
          )}
        </div>
        <Field label="Category" className="col-span-1 md:col-span-2" hint="Group for drop-lowest rules, e.g. Quizzes">
          <Input {...register("category")} placeholder="Midterms" />
        </Field>
        <Field label="Date" className="col-span-1 md:col-span-2">
          <Input type="date" {...register("date")} />
        </Field>
        <Field label="Counts as" className="col-span-2 md:col-span-2">
          <Select {...register("kind")}>
            <option value="regular">Regular assessment</option>
            <option value="bonus">Bonus (adds on top)</option>
            <option value="excused">Excused (removed)</option>
          </Select>
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
