"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, FileText, Link2, ListChecks, Search, CornerDownLeft } from "lucide-react";
import { format } from "date-fns";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { NAV, NAV_SECONDARY } from "./nav";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  group: string;
  title: string;
  meta?: string;
  icon: React.ComponentType<{ className?: string }>;
  go: () => void;
}

const stripHtml = (h: string) => h.replace(/<[^>]+>/g, " ");

export function SearchPalette() {
  const { searchOpen, setSearchOpen, openForm } = useUI();
  const data = useStore((s) => s.data);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(!useUI.getState().searchOpen);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.shiftKey && !typing && !e.metaKey && !e.ctrlKey && !useUI.getState().form) {
        const map: Record<string, () => void> = {
          A: () => openForm({ kind: "assignment" }),
          E: () => openForm({ kind: "event" }),
          C: () => openForm({ kind: "course" }),
          N: () => openForm({ kind: "note" }),
          S: () => openForm({ kind: "study" }),
        };
        const fn = map[e.key];
        if (fn) {
          e.preventDefault();
          fn();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setSearchOpen, openForm]);

  useEffect(() => {
    if (searchOpen) {
      setQ("");
      setSel(0);
    }
  }, [searchOpen]);

  const results = useMemo<Result[]>(() => {
    const go = (href: string) => () => {
      setSearchOpen(false);
      router.push(href);
    };
    const term = q.trim().toLowerCase();
    const pages: Result[] = [...NAV, ...NAV_SECONDARY]
      .filter((n) => !term || n.label.toLowerCase().includes(term))
      .map((n) => ({ id: n.href, group: "Pages", title: n.label, icon: n.icon, go: go(n.href) }));
    if (!term) return pages;
    const has = (...s: (string | null | undefined)[]) => s.some((x) => x?.toLowerCase().includes(term));
    const code = (id: string | null) => data.courses.find((c) => c.id === id)?.code;
    const out: Result[] = [
      ...data.courses.filter((c) => has(c.code, c.name, c.instructor)).map((c) => ({ id: c.id, group: "Courses", title: `${c.code} · ${c.name}`, meta: c.instructor, icon: BookOpen, go: go(`/courses/${c.id}`) })),
      ...data.assignments
        .filter((a) => has(a.title, a.description, code(a.courseId)))
        .map((a) => ({ id: a.id, group: "Assignments", title: a.title, meta: `${code(a.courseId) ?? "No course"} · due ${format(new Date(a.dueAt), "d MMM")}`, icon: ListChecks, go: go(`/assignments?open=${a.id}`) })),
      ...data.events
        .filter((e) => has(e.title, e.location, e.description))
        .map((e) => ({ id: e.id, group: "Events", title: e.title, meta: e.recurrence ? "Recurring" : format(new Date(e.start), "d MMM, HH:mm"), icon: CalendarDays, go: go(`/calendar?date=${format(new Date(e.start), "yyyy-MM-dd")}`) })),
      ...data.notes
        .filter((n) => has(n.title, stripHtml(n.content), n.tags.join(" ")))
        .map((n) => ({ id: n.id, group: "Notes", title: n.title || "Untitled note", meta: code(n.courseId), icon: FileText, go: go(`/notes?note=${n.id}`) })),
      ...data.resources
        .filter((r) => has(r.title, r.category, r.description, r.fileName))
        .map((r) => ({ id: r.id, group: "Resources", title: r.title, meta: r.category, icon: Link2, go: go(`/notes?tab=resources&q=${encodeURIComponent(r.title)}`) })),
    ];
    return [...pages, ...out].slice(0, 40);
  }, [q, data, router, setSearchOpen]);

  if (!searchOpen) return null;
  let lastGroup = "";
  return createPortal(
    <div className="overlay-in fixed inset-0 z-50 flex items-start justify-center bg-[#18242b]/25 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setSearchOpen(false)}>
      <div className="pop-in w-full max-w-xl overflow-hidden rounded-3xl border border-line/70 bg-surface shadow-lift" role="dialog" aria-label="Search">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(results.length - 1, s + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              }
              if (e.key === "Enter") results[sel]?.go();
            }}
            placeholder="Search courses, assignments, events, notes…"
            className="h-12 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            aria-label="Search query"
          />
          <kbd className="num text-[10px] text-faint">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">No matches for “{q}”.</p>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? ((lastGroup = r.group), <div key={`${r.group}-h`} className="eyebrow px-2.5 pb-1 pt-3">{r.group}</div>) : null;
            return (
              <div key={`${r.group}-${r.id}`}>
                {header}
                <button
                  onMouseEnter={() => setSel(i)}
                  onClick={r.go}
                  className={cn("flex h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm", i === sel ? "bg-surface-2 text-ink" : "text-ink-2")}
                >
                  <r.icon className="size-4 shrink-0 text-faint" />
                  <span className="flex-1 truncate">{r.title}</span>
                  {r.meta && <span className="num truncate text-[11px] text-faint">{r.meta}</span>}
                  {i === sel && <CornerDownLeft className="size-3 text-faint" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
