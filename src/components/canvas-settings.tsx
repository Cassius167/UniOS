"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Bookmark, CalendarSync, Copy, Download, RefreshCw, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, Checkbox, Field, Input, Select, Toggle } from "@/components/ui/primitives";
import { Modal, toast, useConfirm } from "@/components/ui/overlay";
import { useStore } from "@/lib/store";
import { bookmarkletHref } from "@/lib/canvas/bookmarklet";
import { applyCanvasImport, parseCanvasExport, planCanvasImport, type CanvasExport, type CoursePlan } from "@/lib/canvas/import";
import { isCanvasFeedUrl } from "@/lib/canvas/feed";
import { syncCanvasFeed } from "@/lib/canvas/sync";

const ago = (iso: string | null) => (iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : "never");

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-3">
      <span className="num grid size-6 place-items-center rounded-full border border-line-strong text-[11px] text-muted">{n}</span>
      <div>
        <div className="text-sm text-ink">{title}</div>
        <div className="mt-1 text-xs leading-relaxed text-muted">{children}</div>
      </div>
    </div>
  );
}

function ImportPreview({ exp, onClose }: { exp: CanvasExport; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const transform = useStore((s) => s.transform);
  const [plan] = useState<CoursePlan[]>(() => planCanvasImport(data, exp));
  // Pre-select courses that have gradeable work or already exist in UniOS.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(plan.filter((p) => p.matchId || p.assessments > 0).map((p) => p.canvasId)));
  const [replaceManual, setReplaceManual] = useState(true);
  const [semesterId, setSemesterId] = useState(data.settings.currentSemesterId ?? "");
  const anyManual = plan.some((p) => selected.has(p.canvasId) && p.manualAssessments > 0 && p.assessments > 0);

  const run = () => {
    let summary = null as ReturnType<typeof applyCanvasImport>["summary"] | null;
    transform((d) => {
      const r = applyCanvasImport(d, exp, { courseIds: selected, replaceManual, semesterId: semesterId || null });
      summary = r.summary;
      return r.data;
    });
    const s = summary!;
    toast.success(`Canvas imported: ${s.coursesCreated + s.coursesLinked} new/linked courses, ${s.assignmentsCreated} new assignments, ${s.assessmentsCreated + s.assessmentsUpdated} grade items`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Import from Canvas"
      eyebrow={`Exported ${ago(exp.exportedAt)} from ${exp.host}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={run} disabled={!selected.size}>
            Import {selected.size} course{selected.size === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-xs leading-relaxed text-muted">Choose which Canvas courses to bring in. Matching courses already in UniOS are updated, not duplicated. Your own priorities, subtasks and completion status are kept. Ungraded work stays ungraded and never counts as zero.</p>
      <ul className="divide-y divide-line/60 rounded-xl border border-line">
        {plan.map((p) => (
          <li key={p.canvasId} className="flex items-start gap-3 px-4 py-3">
            <Checkbox
              checked={selected.has(p.canvasId)}
              label={`Import ${p.name}`}
              onChange={(v) =>
                setSelected((s) => {
                  const n = new Set(s);
                  if (v) n.add(p.canvasId);
                  else n.delete(p.canvasId);
                  return n;
                })
              }
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-xs text-muted">{p.code}</span>
                <span className="truncate text-sm text-ink">{p.name}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                <span>{p.matchLabel ? `Updates ${p.matchLabel}` : "Creates a new course"}</span>
                <span>{p.assessments} grade items ({p.graded} graded)</span>
                <span>{p.tasks} assignments</span>
                {p.term && <span>{p.term}</span>}
              </div>
              {p.manualAssessments > 0 && p.assessments > 0 && (
                <div className="mt-1 text-[11px] text-ochre">This course already has {p.manualAssessments} grade items you entered yourself.</div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {anyManual && (
          <label className="flex items-start gap-2.5 text-xs text-ink md:col-span-2">
            <Checkbox checked={replaceManual} onChange={setReplaceManual} label="Replace manually entered grade items" size="sm" className="mt-0.5" />
            <span>
              Replace grade items I entered myself with Canvas’s grading structure in these courses
              <span className="block text-muted">Recommended. Keeping both would count the same assessments twice.</span>
            </span>
          </label>
        )}
        <Field label="Semester for new courses">
          <Select value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
            <option value="">Unassigned</option>
            {data.settings.semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        Grade weights come from Canvas assignment groups. UniOS’s “average on completed work” can differ slightly from the total Canvas shows while a group is only partly graded, because UniOS weights each graded item individually. Drop-lowest rules are carried over.
      </p>
    </Modal>
  );
}

export function CanvasSettings() {
  const canvas = useStore((s) => s.data.settings.canvas);
  const updateSettings = useStore((s) => s.updateSettings);
  const linkedCourses = useStore((s) => s.data.courses.filter((c) => c.external?.source === "canvas").length);
  const confirm = useConfirm();
  const [feed, setFeed] = useState(canvas.feedUrl);
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState<CanvasExport | null>(null);
  const bm = useRef<HTMLAnchorElement>(null);
  const file = useRef<HTMLInputElement>(null);

  // React blocks javascript: URLs in JSX, so the bookmark link is set directly.
  useEffect(() => {
    bm.current?.setAttribute("href", bookmarkletHref);
  }, []);

  const saveAndSync = async () => {
    const url = feed.trim();
    if (!isCanvasFeedUrl(url)) return toast.error("Paste the Calendar Feed link from Canvas (it ends in .ics).");
    updateSettings({ canvas: { ...canvas, feedUrl: url } });
    setSyncing(true);
    try {
      const s = await syncCanvasFeed();
      toast.success(`Synced: ${s.assignmentsCreated} new, ${s.assignmentsUpdated} updated assignments, ${s.eventsSynced} events${s.unmatchedCourses.length ? `. Not in UniOS yet: ${s.unmatchedCourses.join(", ")}` : ""}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const onFile = async (f: File) => {
    try {
      setPreview(parseCanvasExport(JSON.parse(await f.text())));
    } catch (e) {
      toast.error((e as Error).message.startsWith("Unexpected") ? "That file isn’t valid JSON." : (e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <CalendarSync className="size-4 text-faint" /> Calendar feed: automatic due dates
            </div>
            <p className="mt-1 text-xs text-muted">Keeps assignment due dates and Canvas calendar events up to date every time UniOS is open. No grades or weights.</p>
          </div>
          {canvas.feedUrl ? <Badge tone="sage">Connected</Badge> : <Badge tone="outline">Not set up</Badge>}
        </div>
        <div className="mb-4 flex flex-col gap-3">
          <Step n={1} title="Copy your feed link from Canvas">
            In Canvas, open <b>Calendar</b>, then click <b>Calendar Feed</b> at the bottom of the right-hand column and copy the link.
          </Step>
          <Step n={2} title="Paste it here and sync">
            The link is private to you. It’s saved only in this browser.
          </Step>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input value={feed} onChange={(e) => setFeed(e.target.value)} placeholder="https://canvas.ubc.ca/feeds/calendars/user_….ics" className="min-w-60 flex-1" aria-label="Canvas calendar feed link" />
          <Button variant="primary" onClick={saveAndSync} disabled={syncing}>
            <RefreshCw className={syncing ? "animate-spin" : ""} /> {canvas.feedUrl ? "Sync now" : "Save and sync"}
          </Button>
        </div>
        {canvas.feedUrl && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3 text-xs text-muted">
            <span>Last synced {ago(canvas.lastFeedSync)}</span>
            <label className="flex items-center gap-2">
              <Toggle checked={canvas.autoSync} onChange={(v) => updateSettings({ canvas: { ...canvas, autoSync: v } })} label="Sync automatically" /> Sync automatically
            </label>
            <button
              className="ml-auto flex items-center gap-1 text-faint hover:text-terra"
              onClick={async () => {
                if (await confirm({ title: "Disconnect the calendar feed?", body: "Canvas calendar events are removed from UniOS. Imported assignments stay.", confirmLabel: "Disconnect", destructive: true })) {
                  useStore.getState().transform((d) => ({ ...d, events: d.events.filter((e) => e.source !== "canvas"), settings: { ...d.settings, canvas: { ...d.settings.canvas, feedUrl: "", lastFeedSync: null } } }));
                  setFeed("");
                }
              }}
            >
              <Trash2 className="size-3" /> Disconnect
            </button>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <Bookmark className="size-4 text-faint" /> Export bookmark: courses, weights and grades
            </div>
            <p className="mt-1 text-xs text-muted">One click on Canvas downloads your courses, assignment groups, weights and grades. Then import the file here. Run it whenever you want fresh grades.</p>
          </div>
          {linkedCourses ? <Badge tone="sage">{linkedCourses} linked</Badge> : null}
        </div>
        <div className="mb-5 flex flex-col gap-3">
          <Step n={1} title="Add the bookmark (one time)">
            Show your bookmarks bar with <b>Ctrl+Shift+B</b> (Mac: ⌘+Shift+B), then drag this button onto it:
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <a
                ref={bm}
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("Drag this button to your bookmarks bar, then click it while on Canvas.");
                }}
                className="inline-flex h-8 cursor-grab items-center gap-2 rounded-xl border border-accent-strong bg-accent-strong px-3 text-xs font-medium text-on-accent-strong"
              >
                <Bookmark className="size-3.5" /> Export to UniOS
              </a>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(bookmarkletHref);
                  toast.success("Copied. Create a bookmark and paste this as its URL.");
                }}
              >
                <Copy /> Copy instead
              </Button>
            </span>
          </Step>
          <Step n={2} title="Click it while signed in to Canvas">
            Open any Canvas page and click <b>Export to UniOS</b> in your bookmarks bar. A file named <code className="num">canvas-export-….json</code> downloads. It reads only your own courses and grades, with the login you already have open, and sends nothing anywhere.
          </Step>
          <Step n={3} title="Import the file">
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0]).finally(() => (e.target.value = ""))} />
              <Button size="sm" variant="primary" onClick={() => file.current?.click()}>
                <Upload /> Import Canvas export
              </Button>
              <span className="text-[11px] text-faint">Last import {ago(canvas.lastImport)}</span>
            </span>
          </Step>
        </div>
        <p className="flex items-start gap-2 border-t border-line pt-3 text-[11px] leading-relaxed text-faint">
          <Download className="mt-0.5 size-3 shrink-0" /> Want it fully automatic? If Canvas → Account → Settings shows a “New Access Token” button, UniOS can sync grades in the background instead. Ask for it to be added.
        </p>
      </Card>
      {preview && <ImportPreview exp={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
