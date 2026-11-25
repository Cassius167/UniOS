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
        <div role="menu" className="pop-in absolute right-0 top-12 z-40 w-60 rounded-2xl border border-line/70 bg-surface p-1.5 shadow-lift">
          <div className="eyebrow px-3 pb-1 pt-1.5">Add something new</div>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.run();
              }}
              className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-ink hover:bg-surface-2"
            >
              <it.icon className="size-4 text-faint" strokeWidth={1.6} />
              <span className="flex-1">{it.label}</span>
              <kbd className="text-[11px] text-faint">⇧{it.key}</kbd>
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-bg/80 px-4 backdrop-blur-md md:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
        <Menu />
      </Button>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-medium text-ink">{current?.label ?? "UniOS"}</span>
        <span className="hidden text-xs text-muted sm:inline">{now ? format(now, "EEEE, MMMM d") : ""}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <FocusPill />
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-10 items-center gap-2 rounded-full border border-line/70 bg-surface px-4 text-sm text-faint hover:border-line-strong hover:text-ink md:w-64"
          aria-label="Search"
        >
          <Search className="size-4" />
          <span className="hidden flex-1 text-left md:inline">Search</span>
          <kbd className="hidden rounded-md bg-surface-2 px-1.5 text-[11px] md:inline">⌘K</kbd>
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
