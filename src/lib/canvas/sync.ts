"use client";

import { useStore } from "../store";
import { mergeFeed, parseIcs, type FeedSummary } from "./feed";

/** Downloads the Canvas feed through the local server route and merges it. */
export async function syncCanvasFeed(): Promise<FeedSummary> {
  const url = useStore.getState().data.settings.canvas.feedUrl;
  if (!url) throw new Error("No Canvas calendar feed link saved.");
  const res = await fetch("/api/canvas/feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Sync failed (${res.status})`);
  const events = parseIcs(await res.text());
  let summary: FeedSummary | null = null;
  useStore.getState().transform((d) => {
    const r = mergeFeed(d, events);
    summary = r.summary;
    return r.data;
  });
  return summary!;
}
