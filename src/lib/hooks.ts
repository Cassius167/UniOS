"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import { summarize, type GradeSummary } from "./grades/engine";
import type { Course } from "./types";

/**
 * Current time, ticking every `intervalMs`. Returns null during SSR / before
 * mount so server and client markup match.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useCourseMap(): Map<string, Course> {
  const courses = useStore((s) => s.data.courses);
  return useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
}

/** Grade summary for every course, recomputed only when grades change. */
export function useGradeSummaries(): Map<string, GradeSummary> {
  const courses = useStore((s) => s.data.courses);
  const assessments = useStore((s) => s.data.assessments);
  return useMemo(() => {
    const m = new Map<string, GradeSummary>();
    for (const c of courses) m.set(c.id, summarize(assessments.filter((a) => a.courseId === c.id), c.dropRules));
    return m;
  }, [courses, assessments]);
}

export function useActiveCourses(): Course[] {
  const courses = useStore((s) => s.data.courses);
  return useMemo(() => courses.filter((c) => !c.archived).sort((a, b) => a.code.localeCompare(b.code)), [courses]);
}
