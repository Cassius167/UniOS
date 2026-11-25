"use client";

import { create } from "zustand";

/** Which entity form is open (from quick-add, a card, the calendar …) and with what defaults. */
export type FormRequest =
  | { kind: "assignment"; id?: string; defaults?: { courseId?: string | null; dueDate?: string } }
  | { kind: "event"; id?: string; occurrenceDate?: string; defaults?: { courseId?: string | null; date?: string; start?: string; end?: string; type?: string } }
  | { kind: "course"; id?: string }
  | { kind: "assessment"; id?: string; defaults?: { courseId?: string } }
  | { kind: "note"; defaults?: { courseId?: string | null } }
  | { kind: "study"; defaults?: { courseId?: string | null; date?: string } };

interface UIState {
  form: FormRequest | null;
  openForm(f: FormRequest): void;
  closeForm(): void;
  searchOpen: boolean;
  setSearchOpen(v: boolean): void;
  mobileNavOpen: boolean;
  setMobileNavOpen(v: boolean): void;
}

export const useUI = create<UIState>()((set) => ({
  form: null,
  openForm: (form) => set({ form }),
  closeForm: () => set({ form: null }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}));
