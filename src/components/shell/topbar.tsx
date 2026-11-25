"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { BookOpen, CalendarPlus, ChevronDown, Clock, ListPlus, Menu, Moon, NotebookPen, Plus, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { NAV, NAV_SECONDARY, isActive } from "./nav";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useNow } from "@/lib/hooks";
import { useResolvedTheme } from "./theme";
import { FocusPill } from "./focus-pill";

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openForm = useUI((s) => s.openForm);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const items = [
    { label: "Assignment", icon: ListPlus, key: "A", run: () => openForm({ kind: "assignment" }) },
    { label: "Calendar event", icon: CalendarPlus, key: "E", run: () => openForm({ kind: "event" }) },
    { label: "Course", icon: BookOpen, key: "C", run: () => openForm({ kind: "course" }) },
    { label: "Note", icon: NotebookPen, key: "N", run: () => openForm({ kind: "note" }) },
    { label: "Study session", icon: Clock, key: "S", run: () => openForm({ kind: "study" }) },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button variant="primary" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="pr-2.5">
        <Plus /> <span className="hidden sm:inline">New</span> <ChevronDown className="!size-3 opacity-60" />
      </Button>
      {open && (
        <div role="menu" className="fade-in absolute right-0 top-11 z-40 w-56 rounded-[4px] border border-line bg-surface p-1 shadow-[0_12px_32px_-16px_rgba(24,36,43,0.35)]">
          <div className="eyebrow px-2.5 pb-1 pt-1.5">Quick add</div>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.run();
              }}
              className="flex h-9 w-full items-center gap-3 rounded-[3px] px-2.5 text-left text-sm text-ink hover:bg-surface-2"
            >
              <it.icon className="size-4 text-faint" strokeWidth={1.6} />
              <span className="flex-1">{it.label}</span>
              <kbd className="num text-[10px] text-faint">⇧{it.key}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const now = useNow(60_000);
  const { setSearchOpen, setMobileNavOpen } = useUI();
  const updateSettings = useStore((s) => s.updateSettings);
  const resolved = useResolvedTheme();
  const current = [...NAV, ...NAV_SECONDARY].find((n) => isActive(pathname, n.href));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur md:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
        <Menu />
      </Button>
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="num hidden text-[11px] text-faint sm:inline">{current?.index ?? "—"}</span>
        <span className="truncate text-sm font-medium text-ink">{current?.label ?? "UniOS"}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <FocusPill />
        <span className="num mr-2 hidden text-[11px] uppercase tracking-wider text-faint xl:inline">{now ? format(now, "EEE d MMM · HH:mm") : ""}</span>
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-9 items-center gap-2 rounded-[3px] border border-line-strong bg-surface px-3 text-sm text-faint transition-colors hover:text-ink md:w-64"
          aria-label="Search"
        >
          <Search className="size-4" />
          <span className="hidden flex-1 text-left md:inline">Search everything</span>
          <kbd className="num hidden rounded-[2px] border border-line px-1 text-[10px] md:inline">⌘K</kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => updateSettings({ theme: resolved === "dark" ? "light" : "dark" })}
        >
          {resolved === "dark" ? <Sun /> : <Moon />}
        </Button>
        <QuickAdd />
      </div>
    </header>
  );
}
