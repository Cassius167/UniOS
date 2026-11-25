"use client";

/**
 * Focus timer state. Persisted to localStorage so a running session survives
 * navigation, refreshes and closing the tab. Time is derived from timestamps
 * (never from counting ticks), so pausing, resuming and background tabs stay accurate.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Distraction, DistractionKind, SessionKind } from "./types";
import { uid } from "./ids";

export type FocusMode = "focus" | "break";
export type FocusPhase = "idle" | "running" | "paused" | "review";

interface FocusState {
  phase: FocusPhase;
  mode: FocusMode;
  kind: SessionKind;
  plannedMinutes: number;
  courseId: string | null;
  assignmentId: string | null;
  task: string;
  startedAt: string | null;
  /** Milliseconds focused before the current run segment. */
  accumulatedMs: number;
  /** When the current run segment started (epoch ms), null while paused. */
  resumedAt: number | null;
  distractions: Distraction[];
  completedFocusCount: number;

  start(p: { mode: FocusMode; kind: SessionKind; plannedMinutes: number; courseId: string | null; assignmentId: string | null; task: string }): void;
  pause(): void;
  resume(): void;
  finish(): void;
  discard(): void;
  logDistraction(kind: DistractionKind, note?: string): void;
  removeDistraction(id: string): void;
}

export const elapsedMs = (s: Pick<FocusState, "accumulatedMs" | "resumedAt">, now = Date.now()) => s.accumulatedMs + (s.resumedAt ? now - s.resumedAt : 0);

const idle = {
  phase: "idle" as FocusPhase,
  startedAt: null,
  accumulatedMs: 0,
  resumedAt: null,
  distractions: [] as Distraction[],
};

export const useFocus = create<FocusState>()(
  persist(
    (set, get) => ({
      ...idle,
      mode: "focus",
      kind: "pomodoro",
      plannedMinutes: 25,
      courseId: null,
      assignmentId: null,
      task: "",
      completedFocusCount: 0,

      start: (p) => set({ ...idle, ...p, phase: "running", startedAt: new Date().toISOString(), resumedAt: Date.now() }),
      pause: () => {
        const s = get();
        if (s.phase !== "running") return;
        set({ phase: "paused", accumulatedMs: elapsedMs(s), resumedAt: null });
      },
      resume: () => get().phase === "paused" && set({ phase: "running", resumedAt: Date.now() }),
      finish: () => {
        const s = get();
        const acc = Math.min(elapsedMs(s), s.plannedMinutes * 60_000);
        if (s.mode === "break") return set({ ...idle });
        set({ phase: "review", accumulatedMs: acc, resumedAt: null, completedFocusCount: s.completedFocusCount + 1 });
      },
      discard: () => set({ ...idle }),
      logDistraction: (kind, note = "") => set((s) => ({ distractions: [...s.distractions, { id: uid("dis"), kind, note, at: new Date().toISOString() }] })),
      removeDistraction: (id) => set((s) => ({ distractions: s.distractions.filter((d) => d.id !== id) })),
    }),
    { name: "unios:focus" },
  ),
);
