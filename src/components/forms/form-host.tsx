"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/lib/ui-store";
import { useStore } from "@/lib/store";
import { uid, nowIso } from "@/lib/ids";
import { AssignmentForm } from "./assignment-form";
import { EventForm } from "./event-form";
import { CourseForm } from "./course-form";
import { AssessmentForm } from "./assessment-form";

/** Creates an empty note and opens it in the editor. */
function NewNote({ courseId, onDone }: { courseId?: string | null; onDone: () => void }) {
  const router = useRouter();
  useEffect(() => {
    const id = uid("nte");
    useStore.getState().add("notes", { id, title: "", content: "", courseId: courseId ?? null, folderId: null, tags: [], starred: false, isDemo: false, createdAt: nowIso(), updatedAt: nowIso() });
    onDone();
    router.push(`/notes?note=${id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function FormHost() {
  const { form, closeForm } = useUI();
  if (!form) return null;
  const key = JSON.stringify(form);
  switch (form.kind) {
    case "assignment":
      return <AssignmentForm key={key} id={form.id} defaults={form.defaults} onClose={closeForm} />;
    case "event":
      return <EventForm key={key} id={form.id} occurrenceDate={form.occurrenceDate} defaults={form.defaults} onClose={closeForm} />;
    case "study":
      return <EventForm key={key} defaults={{ ...form.defaults, type: "study", start: "18:00", end: "19:30" }} onClose={closeForm} />;
    case "course":
      return <CourseForm key={key} id={form.id} onClose={closeForm} />;
    case "assessment":
      return <AssessmentForm key={key} id={form.id} defaults={form.defaults} onClose={closeForm} />;
    case "note":
      return <NewNote key={key} courseId={form.defaults?.courseId} onDone={closeForm} />;
  }
}
