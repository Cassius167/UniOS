"use client";

/**
 * Application state. One zustand store holds the whole AppData document and
 * exposes typed CRUD actions. Every change is persisted through the
 * DataRepository (debounced), so pages never deal with storage directly.
 */
import { create } from "zustand";
import type { AppData, CollectionKey, Settings } from "./types";
import type { DataRepository } from "./data/repository";
import { LocalRepository } from "./data/local-repository";
import { emptyData } from "./data/defaults";
import { buildDemoData } from "./data/seed";
import { migrate } from "./data/migrations";
import { nowIso } from "./ids";
import { deleteFile, clearFiles } from "./data/files";

type Item<K extends CollectionKey> = AppData[K][number];
type Status = "idle" | "loading" | "ready" | "error";

interface StoreState {
  data: AppData;
  status: Status;
  error: string | null;
  lastSavedAt: string | null;

  hydrate(): Promise<void>;
  add<K extends CollectionKey>(key: K, item: Item<K>): void;
  update<K extends CollectionKey>(key: K, id: string, patch: Partial<Item<K>>): void;
  remove<K extends CollectionKey>(key: K, id: string): void;
  updateSettings(patch: Partial<Settings>): void;
  /** Deletes a course and everything that belongs to it. */
  removeCourse(id: string): void;
  replaceAll(data: unknown): void;
  removeDemoData(): void;
  loadDemoData(): void;
  reset(): Promise<void>;
}

const repo: DataRepository = new LocalRepository();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<StoreState>()((set, get) => {
  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 250);
  };
  const flush = async () => {
    saveTimer = null;
    try {
      await repo.save(get().data);
      set({ lastSavedAt: nowIso(), error: null });
    } catch (err) {
      set({ error: `Could not save: ${(err as Error).message}` });
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        void repo.save(get().data);
      }
    });
  }

  const mutate = (fn: (d: AppData) => AppData) => {
    set((s) => ({ data: fn(s.data) }));
    persist();
  };

  return {
    data: emptyData(),
    status: "idle",
    error: null,
    lastSavedAt: null,

    async hydrate() {
      if (get().status === "loading" || get().status === "ready") return;
      set({ status: "loading" });
      try {
        const loaded = await repo.load();
        if (loaded) {
          set({ data: loaded, status: "ready" });
        } else {
          // First run: start with clearly-labelled demo data.
          set({ data: buildDemoData(), status: "ready" });
          persist();
        }
      } catch (err) {
        set({ status: "error", error: (err as Error).message });
      }
    },

    add(key, item) {
      mutate((d) => ({ ...d, [key]: [...d[key], item] }));
    },

    update(key, id, patch) {
      mutate((d) => ({
        ...d,
        [key]: (d[key] as { id: string }[]).map((it) =>
          it.id === id ? { ...it, ...patch, ...("updatedAt" in it ? { updatedAt: nowIso() } : {}) } : it,
        ),
      }));
    },

    remove(key, id) {
      if (key === "resources") {
        const r = get().data.resources.find((x) => x.id === id);
        if (r?.fileKey) void deleteFile(r.fileKey).catch(() => undefined);
      }
      mutate((d) => {
        const next = { ...d, [key]: (d[key] as { id: string }[]).filter((it) => it.id !== id) } as AppData;
        if (key === "folders") next.notes = next.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n));
        if (key === "assignments") next.sessions = next.sessions.map((s) => (s.assignmentId === id ? { ...s, assignmentId: null } : s));
        return next;
      });
    },

    updateSettings(patch) {
      mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    },

    removeCourse(id) {
      get()
        .data.resources.filter((r) => r.courseId === id && r.fileKey)
        .forEach((r) => void deleteFile(r.fileKey!).catch(() => undefined));
      mutate((d) => ({
        ...d,
        courses: d.courses.filter((c) => c.id !== id),
        assessments: d.assessments.filter((a) => a.courseId !== id),
        assignments: d.assignments.filter((a) => a.courseId !== id),
        events: d.events.filter((e) => e.courseId !== id),
        resources: d.resources.filter((r) => r.courseId !== id),
        // Keep notes and study history, just detach them.
        notes: d.notes.map((n) => (n.courseId === id ? { ...n, courseId: null } : n)),
        sessions: d.sessions.map((s) => (s.courseId === id ? { ...s, courseId: null } : s)),
      }));
    },

    replaceAll(raw) {
      const data = migrate(raw); // throws on invalid input; caller shows the error
      set({ data });
      persist();
    },

    removeDemoData() {
      mutate((d) => {
        const demoCourseIds = new Set(d.courses.filter((c) => c.isDemo).map((c) => c.id));
        const keep = <T extends { isDemo: boolean }>(xs: T[]) => xs.filter((x) => !x.isDemo);
        return {
          ...d,
          courses: keep(d.courses),
          assessments: keep(d.assessments),
          assignments: keep(d.assignments),
          events: keep(d.events),
          sessions: keep(d.sessions),
          notes: keep(d.notes).map((n) => (n.courseId && demoCourseIds.has(n.courseId) ? { ...n, courseId: null } : n)),
          resources: keep(d.resources),
          folders: d.folders.filter((f) => d.notes.some((n) => n.folderId === f.id && !n.isDemo)),
        };
      });
    },

    loadDemoData() {
      const demo = buildDemoData();
      mutate((d) => ({
        ...d,
        settings: {
          ...d.settings,
          semesters: d.settings.semesters.length ? d.settings.semesters : demo.settings.semesters,
          currentSemesterId: d.settings.currentSemesterId ?? demo.settings.currentSemesterId,
        },
        courses: [...d.courses, ...demo.courses.map((c) => ({ ...c, semesterId: d.settings.currentSemesterId ?? c.semesterId }))],
        assessments: [...d.assessments, ...demo.assessments],
        assignments: [...d.assignments, ...demo.assignments],
        events: [...d.events, ...demo.events],
        sessions: [...d.sessions, ...demo.sessions],
        notes: [...d.notes, ...demo.notes],
        folders: [...d.folders, ...demo.folders],
        resources: [...d.resources, ...demo.resources],
      }));
    },

    async reset() {
      await repo.clear();
      await clearFiles().catch(() => undefined);
      set({ data: emptyData() });
      persist();
    },
  };
});

/** Convenience selector hooks. */
export const useData = () => useStore((s) => s.data);
export const useSettings = () => useStore((s) => s.data.settings);
