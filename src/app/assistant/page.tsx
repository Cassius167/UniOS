"use client";

import { useEffect, useState } from "react";
import { CircleDashed, KeyRound, Lock } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, Spinner } from "@/components/ui/primitives";

interface Status {
  configured: boolean;
  provider: string | null;
  model: string | null;
}

const PLANNED = [
  ["Explain a concept", "Ask about course material and get an explanation grounded in your notes."],
  ["Practice questions", "Generate questions from uploaded lecture notes and slides."],
  ["Summarise documents", "Condense readings and PDFs stored in Resources."],
  ["Break down assignments", "Suggest subtasks and time estimates for a new assignment."],
  ["Identify weak topics", "Spot patterns in grades and notes that need review."],
  ["Exam study plans", "Turn upcoming exams and free time into a study schedule."],
  ["Course Q&A", "Answer questions using only one course’s own resources."],
];

export default function AssistantPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="fade-in">
      <PageHeader index="09 — Study Assistant" title="Study Assistant" subtitle="An AI assistant for your courses is planned for a later phase. Nothing on this page pretends to answer questions yet." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader eyebrow="Phase 4" title="Planned capabilities" />
          <ul className="divide-y divide-line">
            {PLANNED.map(([t, d]) => (
              <li key={t} className="flex items-start gap-4 px-5 py-4">
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-faint" />
                <div className="flex-1">
                  <div className="text-sm text-ink">{t}</div>
                  <div className="text-xs text-muted">{d}</div>
                </div>
                <Badge tone="outline">Not available yet</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <div className="eyebrow mb-3">Provider status</div>
            {!status && !error ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Spinner /> Checking…
              </div>
            ) : status?.configured ? (
              <div className="text-sm text-ink">
                <Badge tone="sage">Key detected</Badge>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  An API key is configured on the server ({status.provider}, {status.model}). The assistant features themselves haven’t been built yet; they’ll use this key from server routes only.
                </p>
              </div>
            ) : (
              <div className="text-sm text-ink">
                <Badge tone="neutral">Not configured</Badge>
                <p className="mt-2 text-xs leading-relaxed text-muted">No AI provider is configured, so the assistant is unavailable.</p>
              </div>
            )}
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
              <KeyRound className="size-4 text-faint" /> To enable later
            </div>
            <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-muted">
              <li>
                Create <code className="num rounded bg-surface-2 px-1">.env.local</code> in the project root.
              </li>
              <li>
                Add <code className="num rounded bg-surface-2 px-1">ANTHROPIC_API_KEY=…</code> (server-side only; never prefix it with NEXT_PUBLIC_).
              </li>
              <li>Restart the dev server. This card will show “Key detected”.</li>
            </ol>
            <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-faint">
              <Lock className="mt-0.5 size-3 shrink-0" /> Requests will go through Next.js route handlers so your key and private notes are never exposed in browser code.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
