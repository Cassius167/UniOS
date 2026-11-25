"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { syncCanvasFeed } from "@/lib/canvas/sync";
import { toast } from "@/components/ui/overlay";

const EVERY_MS = 30 * 60_000;

/** Syncs the Canvas calendar feed when UniOS opens and every 30 minutes while open. */
export function CanvasAutoSync() {
  const ready = useStore((s) => s.status === "ready");
  const enabled = useStore((s) => !!s.data.settings.canvas.feedUrl && s.data.settings.canvas.autoSync);
  useEffect(() => {
    if (!ready || !enabled) return;
    const run = async () => {
      const last = useStore.getState().data.settings.canvas.lastFeedSync;
      if (last && Date.now() - new Date(last).getTime() < EVERY_MS - 5_000) return;
      try {
        const s = await syncCanvasFeed();
        if (s.assignmentsCreated) toast.info(`Canvas: ${s.assignmentsCreated} new assignment${s.assignmentsCreated > 1 ? "s" : ""} added`);
      } catch (e) {
        console.warn("Canvas feed sync failed", e);
      }
    };
    void run();
    const id = setInterval(run, EVERY_MS);
    return () => clearInterval(id);
  }, [ready, enabled]);
  return null;
}
