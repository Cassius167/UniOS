"use client";

/**
 * In-app reminder service. While UniOS is open it checks every 30 seconds for
 * event reminders, assignment deadlines and the daily planning nudge, and
 * shows a toast plus (if permitted) a browser notification. Fired reminders
 * are remembered in localStorage so they don't repeat.
 *
 * Reminders while the app is closed need a push service; that belongs to the
 * Supabase phase (scheduled edge function + Web Push).
 */
import { useEffect } from "react";
import { addDays, format } from "date-fns";
import { useStore } from "@/lib/store";
import { expandEvents } from "@/lib/calendar/recurrence";
import { toast } from "@/components/ui/overlay";

const FIRED_KEY = "unios:reminders:fired";

function fired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
}

function notify(title: string, body: string) {
  toast.info(`${title}: ${body}`);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body, tag: title + body });
    } catch {}
  }
}

export function ReminderService() {
  const ready = useStore((s) => s.status === "ready");
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      const { data } = useStore.getState();
      const n = data.settings.notifications;
      const now = new Date();
      const log = fired();
      const once = (key: string, f: () => void) => {
        if (log[key]) return;
        log[key] = now.getTime();
        f();
      };

      if (n.calendarReminders || n.examReminders) {
        const occ = expandEvents(data.events, now, addDays(now, 2));
        for (const o of occ) {
          if (o.event.reminderMinutes === null) continue;
          const isExam = o.event.type === "exam";
          if (isExam ? !n.examReminders : !n.calendarReminders) continue;
          const at = o.start.getTime() - o.event.reminderMinutes * 60_000;
          if (now.getTime() >= at && now < o.start) {
            once(`evt:${o.key}`, () => notify(o.event.title, `Starts at ${format(o.start, "HH:mm")}${o.event.location ? ` · ${o.event.location}` : ""}`));
          }
        }
      }

      if (n.assignmentReminders) {
        for (const a of data.assignments) {
          if (a.status === "completed") continue;
          const due = new Date(a.dueAt).getTime();
          const lead = n.assignmentLeadHours * 36e5;
          if (now.getTime() >= due - lead && now.getTime() < due) {
            once(`asg:${a.id}:${a.dueAt}`, () => notify(`Due ${format(new Date(a.dueAt), "EEE HH:mm")}`, a.title));
          }
        }
      }

      if (n.dailyPlanning) {
        const [h, m] = n.dailyPlanningTime.split(":").map(Number);
        const t = new Date(now);
        t.setHours(h, m, 0, 0);
        if (now >= t && now.getTime() - t.getTime() < 3 * 36e5) {
          once(`daily:${format(now, "yyyy-MM-dd")}`, () => notify("Plan your day", "Review today's schedule and priority tasks in UniOS."));
        }
      }

      // Forget entries older than a week.
      for (const k of Object.keys(log)) if (now.getTime() - log[k] > 7 * 864e5) delete log[k];
      localStorage.setItem(FIRED_KEY, JSON.stringify(log));
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [ready]);
  return null;
}
