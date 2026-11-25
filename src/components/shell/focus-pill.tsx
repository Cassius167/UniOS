"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { elapsedMs, useFocus } from "@/lib/focus-store";
import { toast } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";

/** Shows the active timer in the top bar on every page and completes it on time. */
export function FocusPill() {
  const f = useFocus();
  const pathname = usePathname();
  const [, tick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (f.phase !== "running") return;
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [f.phase]);
  const remaining = f.plannedMinutes * 60_000 - elapsedMs(f);
  useEffect(() => {
    if (pathname !== "/focus" && f.phase === "running" && remaining <= 0) {
      f.finish();
      toast.success(f.mode === "break" ? "Break over" : "Focus session complete. Open Focus to save it.");
    }
  });
  if (!mounted || (f.phase !== "running" && f.phase !== "paused" && f.phase !== "review") || pathname === "/focus") return null;
  const secs = Math.max(0, Math.ceil(remaining / 1000));
  return (
    <Link href="/focus" className={cn("num flex h-8 items-center gap-2 rounded-full border px-3 text-xs", f.phase === "review" ? "border-accent text-accent-ink" : "border-line-strong text-ink")}>
      <span className={cn("size-1.5 rounded-full", f.phase === "running" ? "animate-pulse bg-accent" : "bg-faint")} />
      {f.phase === "review" ? "Save session" : `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`}
    </Link>
  );
}
