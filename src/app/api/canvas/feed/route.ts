import { NextResponse } from "next/server";
import { isCanvasFeedUrl } from "@/lib/canvas/feed";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Fetches a Canvas calendar feed on the server (browsers can't read it
 * directly because of CORS). Only URLs shaped like a Canvas feed are allowed,
 * and the URL is never logged or stored server-side.
 */
export async function POST(req: Request) {
  let url: string;
  try {
    url = String((await req.json()).url ?? "").trim().replace(/^webcal:/i, "https:");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!isCanvasFeedUrl(url)) return NextResponse.json({ error: "That doesn’t look like a Canvas calendar feed link (…/feeds/calendars/….ics)." }, { status: 400 });
  try {
    const res = await fetch(url, { headers: { Accept: "text/calendar" }, redirect: "follow", signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: `Canvas responded with ${res.status}. Check the link is current.` }, { status: 502 });
    const text = await res.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: "Feed is unexpectedly large." }, { status: 502 });
    if (!text.includes("BEGIN:VCALENDAR")) return NextResponse.json({ error: "The link didn’t return a calendar." }, { status: 502 });
    return new NextResponse(text, { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
  } catch (err) {
    return NextResponse.json({ error: `Couldn’t reach Canvas: ${(err as Error).message}` }, { status: 502 });
  }
}
