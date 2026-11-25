"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Download, ExternalLink, File, FileImage, FileText, Link2, Plus, Presentation, Search, Trash2, Upload } from "lucide-react";
import { Button, Card, DemoBadge, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Modal, toast, useConfirm } from "@/components/ui/overlay";
import { CourseTag } from "@/components/domain";
import { useStore } from "@/lib/store";
import { useActiveCourses, useCourseMap } from "@/lib/hooks";
import { uid, nowIso } from "@/lib/ids";
import { getFile, MAX_FILE_BYTES, putFile } from "@/lib/data/files";
import { RESOURCE_KINDS, type Resource, type ResourceKind } from "@/lib/types";
import { RESOURCE_KIND_LABEL } from "@/lib/labels";

const ICON: Record<ResourceKind, React.ComponentType<{ className?: string }>> = { link: Link2, pdf: FileText, document: File, slides: Presentation, image: FileImage, other: File };

function kindFromFile(f: globalThis.File): ResourceKind {
  if (f.type === "application/pdf") return "pdf";
  if (f.type.startsWith("image/")) return "image";
  if (/presentation|powerpoint|keynote/.test(f.type) || /\.(pptx?|key)$/i.test(f.name)) return "slides";
  if (/word|document|text|rtf|opendocument/.test(f.type) || /\.(docx?|odt|txt|md)$/i.test(f.name)) return "document";
  return "other";
}

const fmtSize = (b: number | null) => (b === null ? "" : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function ResourceForm({ courseId, onClose }: { courseId?: string | null; onClose: () => void }) {
  const add = useStore((s) => s.add);
  const courses = useActiveCourses();
  const existingCategories = useStore((s) => [...new Set(s.data.resources.map((r) => r.category))]);
  const [mode, setMode] = useState<"link" | "file">("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<globalThis.File | null>(null);
  const [kind, setKind] = useState<ResourceKind>("link");
  const [course, setCourse] = useState(courseId ?? "");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const save = async () => {
    setError(null);
    if (mode === "link") {
      if (!/^https?:\/\/\S+$/i.test(url.trim())) return setError("Enter a full link starting with https://");
    } else if (!file) return setError("Choose a file to upload");
    if (file && file.size > MAX_FILE_BYTES) return setError(`Files are limited to ${fmtSize(MAX_FILE_BYTES)} while stored in the browser.`);
    setSaving(true);
    try {
      const id = uid("res");
      let fileKey: string | null = null;
      if (mode === "file" && file) {
        fileKey = `file_${id}`;
        await putFile(fileKey, file);
      }
      add("resources", {
        id,
        title: title.trim() || (mode === "file" ? file!.name : url.trim()),
        kind: mode === "link" ? "link" : kind,
        courseId: course || null,
        category: category.trim() || "General",
        url: mode === "link" ? url.trim() : null,
        fileKey,
        fileName: file?.name ?? null,
        fileSize: file?.size ?? null,
        mimeType: file?.type ?? null,
        description,
        isDemo: false,
        createdAt: nowIso(),
      } satisfies Resource);
      toast.success("Resource added");
      onClose();
    } catch (err) {
      setError(`Could not store the file: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add resource"
      eyebrow="Resources"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Add resource"}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex gap-2">
        {(["link", "file"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "primary" : "secondary"} onClick={() => setMode(m)}>
            {m === "link" ? <Link2 /> : <Upload />} {m === "link" ? "External link" : "Upload file"}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {mode === "link" ? (
          <Field label="Link" className="col-span-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" data-autofocus />
          </Field>
        ) : (
          <div className="col-span-2">
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.key,.odt,.txt,.md,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) {
                  setKind(kindFromFile(f));
                  if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  setFile(f);
                  setKind(kindFromFile(f));
                  if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
                }
              }}
              className="flex w-full flex-col items-center gap-1 rounded-[3px] border border-dashed border-line-strong px-4 py-8 text-sm text-muted hover:border-ink/40"
            >
              <Upload className="size-5 text-faint" />
              {file ? (
                <span className="text-ink">
                  {file.name} <span className="num text-xs text-faint">{fmtSize(file.size)}</span>
                </span>
              ) : (
                <span>Drop a PDF, document, slides or image, or click to choose</span>
              )}
            </button>
            <p className="mt-1.5 text-[11px] text-faint">Files are stored privately in this browser (up to {fmtSize(MAX_FILE_BYTES)} each). Include them in backups by keeping the browser data; JSON export covers metadata only.</p>
          </div>
        )}
        <Field label="Title" className="col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lecture 12 slides" />
        </Field>
        {mode === "file" && (
          <Field label="Kind">
            <Select value={kind} onChange={(e) => setKind(e.target.value as ResourceKind)}>
              {RESOURCE_KINDS.filter((k) => k !== "link").map((k) => (
                <option key={k} value={k}>
                  {RESOURCE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Course">
          <Select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">No course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} list="resource-categories" />
          <datalist id="resource-categories">
            {["Lecture slides", "Readings", "Past exams", "Lab manuals", "Course site", ...existingCategories].filter((v, i, a) => a.indexOf(v) === i).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Notes" className="col-span-2">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-14" />
        </Field>
      </div>
      {error && <p className="mt-3 text-xs text-terra">{error}</p>}
    </Modal>
  );
}

async function openResource(r: Resource, download = false) {
  if (r.url) return void window.open(r.url, "_blank", "noopener,noreferrer");
  if (!r.fileKey) return;
  const blob = await getFile(r.fileKey).catch(() => undefined);
  if (!blob) return toast.error("The file is missing from this browser’s storage.");
  const href = URL.createObjectURL(blob);
  if (download) {
    const a = document.createElement("a");
    a.href = href;
    a.download = r.fileName ?? r.title;
    a.click();
  } else window.open(href, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export function ResourceLibrary({ courseId, initialQuery = "" }: { courseId?: string; initialQuery?: string }) {
  const resources = useStore((s) => s.data.resources);
  const remove = useStore((s) => s.remove);
  const courses = useActiveCourses();
  const courseMap = useCourseMap();
  const confirm = useConfirm();
  const [q, setQ] = useState(initialQuery);
  const [course, setCourse] = useState(courseId ?? "");
  const [kind, setKind] = useState("");
  const [adding, setAdding] = useState(false);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return resources
      .filter((r) => (!course || r.courseId === course) && (!kind || r.kind === kind) && (!t || [r.title, r.category, r.description, r.fileName].some((x) => x?.toLowerCase().includes(t))))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [resources, q, course, kind]);
  const groups = [...new Set(list.map((r) => r.category))].sort();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources" className="pl-9" aria-label="Search resources" />
        </div>
        {!courseId && (
          <Select value={course} onChange={(e) => setCourse(e.target.value)} className="w-auto" aria-label="Filter by course">
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </Select>
        )}
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto" aria-label="Filter by kind">
          <option value="">All kinds</option>
          {RESOURCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {RESOURCE_KIND_LABEL[k]}
            </option>
          ))}
        </Select>
        <Button variant="primary" className="ml-auto" onClick={() => setAdding(true)}>
          <Plus /> Add resource
        </Button>
      </div>
      {list.length ? (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <Card key={g}>
              <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
                <span className="eyebrow">{g}</span>
                <span className="num text-[11px] text-faint">{list.filter((r) => r.category === g).length}</span>
              </div>
              <ul className="divide-y divide-line">
                {list
                  .filter((r) => r.category === g)
                  .map((r) => {
                    const Icon = ICON[r.kind];
                    return (
                      <li key={r.id} className="group flex items-center gap-4 px-5 py-3">
                        <Icon className="size-4 shrink-0 text-faint" />
                        <button onClick={() => openResource(r)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm text-ink group-hover:underline group-hover:underline-offset-2">{r.title}</span>
                            {r.isDemo && <DemoBadge />}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
                            <span>{RESOURCE_KIND_LABEL[r.kind]}</span>
                            {!courseId && <CourseTag course={r.courseId ? courseMap.get(r.courseId) : null} />}
                            {r.url && <span className="num truncate">{new URL(r.url).hostname}</span>}
                            {r.fileSize !== null && <span className="num">{fmtSize(r.fileSize)}</span>}
                            <span className="num text-faint">{format(new Date(r.createdAt), "d MMM yyyy")}</span>
                          </div>
                          {r.description && <p className="mt-1 text-xs text-muted">{r.description}</p>}
                        </button>
                        {r.url ? (
                          <Button size="icon" variant="ghost" onClick={() => openResource(r)} aria-label="Open link">
                            <ExternalLink className="!size-3.5" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" onClick={() => openResource(r, true)} aria-label="Download">
                            <Download className="!size-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete resource"
                          onClick={async () => {
                            if (await confirm({ title: "Delete resource?", body: `“${r.title}” will be removed${r.fileKey ? ", including the stored file" : ""}.`, confirmLabel: "Delete", destructive: true })) {
                              remove("resources", r.id);
                              toast.success("Resource deleted");
                            }
                          }}
                        >
                          <Trash2 className="!size-3.5" />
                        </Button>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Link2 />}
            title={q || kind ? "No resources match" : "No resources yet"}
            body="Collect lecture slides, readings, past exams and useful links, organised by course and category."
            action={<Button size="sm" onClick={() => setAdding(true)}>Add resource</Button>}
          />
        </Card>
      )}
      <p className="mt-4 text-[11px] text-faint">AI document analysis (summaries, practice questions) is not available yet. See Study Assistant for what’s planned.</p>
      {adding && <ResourceForm courseId={courseId ?? (course || null)} onClose={() => setAdding(false)} />}
    </div>
  );
}
