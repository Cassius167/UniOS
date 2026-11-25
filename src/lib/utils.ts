import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from "date-fns";

/** Joins class names; later Tailwind utilities override earlier conflicting ones (e.g. w-full → w-auto). */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return twMerge(parts.filter(Boolean).join(" "));
}

export function pct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

export function hours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function relativeDue(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = format(d, "HH:mm");
  if (isToday(d)) return `Today ${time}`;
  if (isTomorrow(d)) return `Tomorrow ${time}`;
  if (isYesterday(d)) return `Yesterday ${time}`;
  const diff = d.getTime() - now.getTime();
  const rel = formatDistanceToNowStrict(d, { addSuffix: true });
  return Math.abs(diff) < 7 * 864e5 ? `${format(d, "EEE")} ${time} · ${rel}` : `${format(d, "d MMM")} · ${rel}`;
}

export type Urgency = "overdue" | "today" | "soon" | "later";
export function urgency(iso: string, now = new Date()): Urgency {
  const h = (new Date(iso).getTime() - now.getTime()) / 36e5;
  if (h < 0) return "overdue";
  if (h < 24 || isToday(new Date(iso))) return "today";
  if (h < 72) return "soon";
  return "later";
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Combine a yyyy-MM-dd and HH:mm (local) into an ISO instant. */
export function toIso(date: string, time: string): string {
  return new Date(`${date}T${time || "00:00"}:00`).toISOString();
}
export const dateInput = (iso: string) => format(new Date(iso), "yyyy-MM-dd");
export const timeInput = (iso: string) => format(new Date(iso), "HH:mm");

export function downloadFile(name: string, contents: string, type = "application/json") {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
