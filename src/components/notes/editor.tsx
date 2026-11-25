"use client";

import { useEffect, useRef } from "react";
import { Bold, Code, Heading1, Heading2, Heading3, Italic, List, ListChecks, ListOrdered, Quote, Underline, Link as LinkIcon, Pilcrow } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

/**
 * Lightweight rich-text editor built on contentEditable. Keeps dependencies
 * at zero; output is sanitized HTML. Content is only pushed into the DOM
 * when `docKey` changes so typing never resets the caret.
 */
export function RichEditor({ docKey, html, onChange, placeholder = "Start writing…" }: { docKey: string; html: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeHtml(html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  const emit = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => ref.current && latest.current(sanitizeHtml(ref.current.innerHTML)), 300);
  };
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (ref.current) latest.current(sanitizeHtml(ref.current.innerHTML));
      }
    },
    [docKey],
  );

  const exec = (cmd: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
    emit();
  };

  const tools: { icon: React.ComponentType<{ className?: string }>; label: string; run: () => void; sep?: boolean }[] = [
    { icon: Pilcrow, label: "Paragraph", run: () => exec("formatBlock", "<p>") },
    { icon: Heading1, label: "Heading 1", run: () => exec("formatBlock", "<h1>") },
    { icon: Heading2, label: "Heading 2", run: () => exec("formatBlock", "<h2>") },
    { icon: Heading3, label: "Heading 3", run: () => exec("formatBlock", "<h3>"), sep: true },
    { icon: Bold, label: "Bold (⌘B)", run: () => exec("bold") },
    { icon: Italic, label: "Italic (⌘I)", run: () => exec("italic") },
    { icon: Underline, label: "Underline (⌘U)", run: () => exec("underline") },
    {
      icon: Code,
      label: "Inline code",
      run: () => {
        const t = window.getSelection()?.toString() ?? "";
        exec("insertHTML", `<code>${t.replace(/</g, "&lt;") || "code"}</code>&nbsp;`);
      },
      sep: true,
    },
    { icon: List, label: "Bulleted list", run: () => exec("insertUnorderedList") },
    { icon: ListOrdered, label: "Numbered list", run: () => exec("insertOrderedList") },
    {
      icon: ListChecks,
      label: "Checklist",
      run: () => {
        const t = window.getSelection()?.toString() ?? "";
        exec("insertHTML", `<ul data-checklist><li data-checked="false">${t.replace(/</g, "&lt;") || "To do"}</li></ul><p><br></p>`);
      },
    },
    { icon: Quote, label: "Quote", run: () => exec("formatBlock", "<blockquote>") },
    {
      icon: LinkIcon,
      label: "Link",
      run: () => {
        const url = window.prompt("Link URL (https://…)");
        if (url && /^https?:\/\//i.test(url)) exec("createLink", url);
      },
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="toolbar" aria-label="Formatting" className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 border-b border-line bg-surface px-3 py-1.5">
        {tools.map((t) => (
          <span key={t.label} className="flex items-center">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={t.run} title={t.label} aria-label={t.label} className="grid size-7 place-items-center rounded-[3px] text-muted hover:bg-surface-2 hover:text-ink">
              <t.icon className="size-3.5" />
            </button>
            {t.sep && <span className="mx-1 h-4 w-px bg-line" />}
          </span>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Note content"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={() => ref.current && latest.current(sanitizeHtml(ref.current.innerHTML))}
        onClick={(e) => {
          // Toggle checklist items when the box (left gutter) is clicked.
          const li = (e.target as HTMLElement).closest("ul[data-checklist] > li") as HTMLElement | null;
          if (!li) return;
          const x = e.clientX - li.getBoundingClientRect().left;
          if (x <= 18) {
            li.dataset.checked = li.dataset.checked === "true" ? "false" : "true";
            emit();
          }
        }}
        className={cn("prose-note min-h-[50vh] flex-1 px-6 py-5 text-ink md:px-10")}
      />
    </div>
  );
}
