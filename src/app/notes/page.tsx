"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Clock, FileText, Folder as FolderIcon, FolderPlus, Hash, Inbox, Plus, Search, Star, Trash2, X } from "lucide-react";
import { Button, Card, DemoBadge, EmptyState, Input, PageHeader, Select, Tabs } from "@/components/ui/primitives";
import { toast, useConfirm } from "@/components/ui/overlay";
import { RichEditor } from "@/components/notes/editor";
import { ResourceLibrary } from "@/components/resources";
import { useStore } from "@/lib/store";
import { useActiveCourses, useCourseMap } from "@/lib/hooks";
import { uid, nowIso } from "@/lib/ids";
import { htmlToText } from "@/lib/sanitize";
import { TONES } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Scope = { kind: "all" } | { kind: "recent" } | { kind: "starred" } | { kind: "course"; id: string } | { kind: "folder"; id: string } | { kind: "tag"; tag: string };

function NoteEditor({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const note = useStore((s) => s.data.notes.find((n) => n.id === id));
  const folders = useStore((s) => s.data.folders);
  const { update, remove } = useStore.getState();
  const courses = useActiveCourses();
  const confirm = useConfirm();
  const [tagInput, setTagInput] = useState("");
  if (!note) return <EmptyState title="Note not found" />;
  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (t && !note.tags.includes(t)) update("notes", note.id, { tags: [...note.tags, t] });
    setTagInput("");
  };
  return (
    <Card className="flex min-h-[70vh] flex-col">
      <div className="border-b border-line px-6 pb-4 pt-5 md:px-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select value={note.courseId ?? ""} onChange={(e) => update("notes", note.id, { courseId: e.target.value || null })} className="h-7 w-auto text-xs" aria-label="Course">
            <option value="">No course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </Select>
          <Select value={note.folderId ?? ""} onChange={(e) => update("notes", note.id, { folderId: e.target.value || null })} className="h-7 w-auto text-xs" aria-label="Folder">
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          {note.isDemo && <DemoBadge />}
          <span className="num ml-auto text-[10px] text-faint">Edited {formatDistanceToNowStrict(new Date(note.updatedAt), { addSuffix: true })}</span>
          <Button size="icon" variant="ghost" onClick={() => update("notes", note.id, { starred: !note.starred })} aria-label={note.starred ? "Unstar" : "Star"} aria-pressed={note.starred}>
            <Star className={cn(note.starred && "fill-ochre text-ochre")} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete note"
            onClick={async () => {
              if (await confirm({ title: "Delete note?", body: `“${note.title || "Untitled note"}” will be permanently deleted.`, confirmLabel: "Delete", destructive: true })) {
                remove("notes", note.id);
                toast.success("Note deleted");
                onDeleted();
              }
            }}
          >
            <Trash2 />
          </Button>
        </div>
        <input
          key={note.id}
          defaultValue={note.title}
          onChange={(e) => update("notes", note.id, { title: e.target.value })}
          placeholder="Untitled note"
          className="w-full bg-transparent font-serif text-4xl leading-tight text-ink placeholder:text-faint focus:outline-none"
          aria-label="Note title"
          autoFocus={!note.title}
        />
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {note.tags.map((t) => (
            <span key={t} className="num inline-flex items-center gap-1 rounded-[3px] bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
              #{t}
              <button onClick={() => update("notes", note.id, { tags: note.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}>
                <X className="size-2.5" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="+ tag"
            className="num h-6 w-20 bg-transparent text-[11px] text-ink placeholder:text-faint focus:outline-none"
            aria-label="Add tag"
          />
        </div>
      </div>
      <RichEditor docKey={note.id} html={note.content} onChange={(content) => content !== useStore.getState().data.notes.find((n) => n.id === note.id)?.content && update("notes", note.id, { content })} />
    </Card>
  );
}

function NotesWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const notes = useStore((s) => s.data.notes);
  const folders = useStore((s) => s.data.folders);
  const { add, remove } = useStore.getState();
  const courses = useActiveCourses();
  const courseMap = useCourseMap();
  const confirm = useConfirm();
  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(params.get("note"));
  const [newFolder, setNewFolder] = useState<string | null>(null);

  useEffect(() => {
    const n = params.get("note");
    if (n) setSelected(n);
  }, [params]);

  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    let xs = notes.filter((n) => !t || n.title.toLowerCase().includes(t) || htmlToText(n.content).toLowerCase().includes(t) || n.tags.some((g) => g.includes(t)));
    if (scope.kind === "starred") xs = xs.filter((n) => n.starred);
    if (scope.kind === "course") xs = xs.filter((n) => n.courseId === scope.id);
    if (scope.kind === "folder") xs = xs.filter((n) => n.folderId === scope.id);
    if (scope.kind === "tag") xs = xs.filter((n) => n.tags.includes(scope.tag));
    xs = [...xs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (scope.kind === "recent") xs = xs.slice(0, 10);
    return xs;
  }, [notes, q, scope]);

  const create = () => {
    const id = uid("nte");
    add("notes", {
      id,
      title: "",
      content: "",
      courseId: scope.kind === "course" ? scope.id : null,
      folderId: scope.kind === "folder" ? scope.id : null,
      tags: scope.kind === "tag" ? [scope.tag] : [],
      starred: scope.kind === "starred",
      isDemo: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    setSelected(id);
  };

  const ScopeBtn = ({ s, icon: Icon, label, count, color }: { s: Scope; icon?: React.ComponentType<{ className?: string }>; label: string; count?: number; color?: string }) => {
    const active = JSON.stringify(s) === JSON.stringify(scope);
    return (
      <button onClick={() => setScope(s)} className={cn("flex h-8 w-full items-center gap-2.5 rounded-[3px] px-2.5 text-left text-[13px]", active ? "bg-accent-soft text-ink" : "text-muted hover:bg-surface-2 hover:text-ink")}>
        {color ? <span className="size-2 rounded-full" style={{ background: color }} /> : Icon ? <Icon className="size-3.5" /> : null}
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && <span className="num text-[10px] text-faint">{count}</span>}
      </button>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_280px_1fr]">
      <nav aria-label="Note collections" className="flex flex-col gap-0.5">
        <ScopeBtn s={{ kind: "all" }} icon={Inbox} label="All notes" count={notes.length} />
        <ScopeBtn s={{ kind: "recent" }} icon={Clock} label="Recent" />
        <ScopeBtn s={{ kind: "starred" }} icon={Star} label="Starred" count={notes.filter((n) => n.starred).length} />
        <div className="eyebrow mb-1 mt-5 px-2.5">Courses</div>
        {courses.map((c) => (
          <ScopeBtn key={c.id} s={{ kind: "course", id: c.id }} label={c.code} color={TONES[c.tone]} count={notes.filter((n) => n.courseId === c.id).length} />
        ))}
        <div className="eyebrow mb-1 mt-5 flex items-center justify-between px-2.5">
          Folders
          <button onClick={() => setNewFolder("")} aria-label="New folder" className="text-faint hover:text-ink">
            <FolderPlus className="size-3.5" />
          </button>
        </div>
        {newFolder !== null && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newFolder.trim()) add("folders", { id: uid("fld"), name: newFolder.trim(), createdAt: nowIso() });
              setNewFolder(null);
            }}
          >
            <Input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onBlur={() => setNewFolder(null)} placeholder="Folder name" className="h-8 text-xs" />
          </form>
        )}
        {folders.map((f) => (
          <div key={f.id} className="group relative">
            <ScopeBtn s={{ kind: "folder", id: f.id }} icon={FolderIcon} label={f.name} count={notes.filter((n) => n.folderId === f.id).length} />
            <button
              className="absolute right-8 top-2 hidden text-faint hover:text-terra group-hover:block"
              aria-label={`Delete folder ${f.name}`}
              onClick={async () => {
                if (await confirm({ title: `Delete folder “${f.name}”?`, body: "Notes inside are kept and moved out of the folder.", confirmLabel: "Delete folder", destructive: true })) {
                  remove("folders", f.id);
                  if (scope.kind === "folder" && scope.id === f.id) setScope({ kind: "all" });
                }
              }}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {tags.length > 0 && (
          <>
            <div className="eyebrow mb-1 mt-5 px-2.5">Tags</div>
            <div className="flex flex-wrap gap-1 px-2">
              {tags.map((t) => (
                <button key={t} onClick={() => setScope({ kind: "tag", tag: t })} className={cn("num rounded-[3px] px-1.5 py-0.5 text-[11px]", scope.kind === "tag" && scope.tag === t ? "bg-ink text-bg" : "bg-surface-2 text-muted hover:text-ink")}>
                  #{t}
                </button>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="pl-9" aria-label="Search notes" />
          </div>
          <Button variant="primary" size="icon" className="h-9 w-9" onClick={create} aria-label="New note">
            <Plus />
          </Button>
        </div>
        <Card className="max-h-[75vh] overflow-y-auto">
          {list.length ? (
            <ul className="divide-y divide-line">
              {list.map((n) => {
                const c = n.courseId ? courseMap.get(n.courseId) : undefined;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        setSelected(n.id);
                        router.replace(`/notes?note=${n.id}`);
                      }}
                      className={cn("block w-full px-4 py-3 text-left", selected === n.id ? "bg-accent-soft" : "hover:bg-surface-2/60")}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate text-sm font-medium text-ink">{n.title || "Untitled note"}</span>
                        {n.starred && <Star className="size-3 fill-ochre text-ochre" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{htmlToText(n.content) || "Empty note"}</p>
                      <div className="num mt-1.5 flex items-center gap-2 text-[10px] text-faint">
                        {c && <span style={{ color: TONES[c.tone] }}>{c.code}</span>}
                        <span>{format(new Date(n.updatedAt), "d MMM")}</span>
                        {n.tags.slice(0, 2).map((t) => (
                          <span key={t}>
                            <Hash className="inline size-2.5" />
                            {t}
                          </span>
                        ))}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<FileText />} title={q ? "No notes match" : "No notes here yet"} action={<Button size="sm" onClick={create}>New note</Button>} />
          )}
        </Card>
      </div>

      <div className="min-w-0">
        {selected && notes.some((n) => n.id === selected) ? (
          <NoteEditor
            key={selected}
            id={selected}
            onDeleted={() => {
              setSelected(null);
              router.replace("/notes");
            }}
          />
        ) : (
          <Card className="flex min-h-[50vh] items-center justify-center">
            <EmptyState icon={<FileText />} title="Select a note or start a new one" body="Headings, lists, checklists and basic formatting are supported. Notes save as you type." action={<Button size="sm" variant="primary" onClick={create}>New note</Button>} />
          </Card>
        )}
      </div>
    </div>
  );
}

function NotesInner() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"notes" | "resources">(params.get("tab") === "resources" ? "resources" : "notes");
  const noteCount = useStore((s) => s.data.notes.length);
  const resCount = useStore((s) => s.data.resources.length);
  useEffect(() => {
    if (params.get("tab") === "resources") setTab("resources");
    if (params.get("note")) setTab("notes");
  }, [params]);
  return (
    <div className="fade-in">
      <PageHeader index="07 — Notes & Resources" title="Notes & Resources" subtitle="Your personal knowledge base, organised by course, folder and tag." />
      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "notes", label: "Notes", count: noteCount },
            { value: "resources", label: "Resources", count: resCount },
          ]}
        />
      </div>
      {tab === "notes" ? <NotesWorkspace /> : <ResourceLibrary initialQuery={params.get("q") ?? ""} />}
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense>
      <NotesInner />
    </Suspense>
  );
}
