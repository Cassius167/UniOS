"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { Bell, Database, Link2, Download, GraduationCap, Palette, Plus, RotateCcw, Trash2, Upload, User } from "lucide-react";
import { Button, Card, Field, Input, PageHeader, Segmented, Select, Toggle } from "@/components/ui/primitives";
import { toast, useConfirm } from "@/components/ui/overlay";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/ids";
import { UBC_SCALE } from "@/lib/data/defaults";
import { DASHBOARD_WIDGETS, type AccentColour, type DashboardWidget, type Profile, type Semester, type ThemeMode } from "@/lib/types";
import { cn, downloadFile } from "@/lib/utils";
import { CanvasSettings } from "@/components/canvas-settings";

const WIDGET_LABEL: Record<DashboardWidget, string> = {
  today: "Today at a glance",
  schedule: "Today’s schedule",
  priority: "Priority tasks",
  deadlines: "Upcoming deadlines",
  courses: "Course overview",
  productivity: "Productivity summary",
};

function Section({ id, icon: Icon, title, description, children }: { id: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-6 border-b border-line py-10 first:pt-0 lg:grid-cols-[260px_1fr]">
      <div>
        <Icon className="mb-3 size-4 text-faint" />
        <h2 className="font-serif text-2xl text-ink">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line py-3.5 last:border-0">
      <div>
        <div className="text-sm text-ink">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const settings = useStore((s) => s.data.settings);
  const data = useStore((s) => s.data);
  const lastSavedAt = useStore((s) => s.lastSavedAt);
  const { updateSettings, replaceAll, removeDemoData, loadDemoData, reset } = useStore.getState();
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile>(settings.profile);
  const [notifPerm, setNotifPerm] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const setP = (k: keyof Profile, v: string) => setProfile((p) => ({ ...p, [k]: v }));
  const saveProfile = () => {
    updateSettings({ profile });
    toast.success("Profile saved");
  };
  const setSemester = (id: string, patch: Partial<Semester>) => updateSettings({ semesters: settings.semesters.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const demoCount = data.courses.filter((c) => c.isDemo).length + data.assignments.filter((a) => a.isDemo).length + data.events.filter((e) => e.isDemo).length + data.assessments.filter((a) => a.isDemo).length + data.sessions.filter((s) => s.isDemo).length + data.notes.filter((n) => n.isDemo).length + data.resources.filter((r) => r.isDemo).length;

  const exportData = (label: string) => {
    downloadFile(`unios-${label}-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`, JSON.stringify(data, null, 2));
    toast.success(label === "backup" ? "Backup downloaded" : "Data exported");
  };

  const importData = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      if (!(await confirm({ title: "Replace all data?", body: `Importing “${file.name}” will replace everything currently in UniOS. Download a backup first if you might need it.`, confirmLabel: "Import and replace", destructive: true }))) return;
      replaceAll(json);
      setProfile(useStore.getState().data.settings.profile);
      toast.success("Data imported");
    } catch (err) {
      toast.error(`Import failed: ${(err as Error).message}`);
    }
  };

  return (
    <div>
      <PageHeader
       
        title="Settings"
        subtitle={lastSavedAt ? `All changes save automatically · last saved ${format(new Date(lastSavedAt), "HH:mm:ss")}` : "All changes save automatically to this browser."}
      />
      <nav className="mb-8 flex flex-wrap gap-4 text-xs text-muted">
        {[
          ["profile", "Profile"],
          ["academic", "Academic"],
          ["appearance", "Appearance"],
          ["notifications", "Notifications"],
          ["canvas", "Canvas"],
          ["data", "Data"],
        ].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="hover:text-ink">
            {l}
          </a>
        ))}
      </nav>

      <Section id="profile" icon={User} title="Profile" description="Used for your greeting and to tailor UniOS to your program.">
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input value={profile.name} onChange={(e) => setP("name", e.target.value)} />
            </Field>
            <Field label="University">
              <Input value={profile.university} onChange={(e) => setP("university", e.target.value)} />
            </Field>
            <Field label="Faculty">
              <Input value={profile.faculty} onChange={(e) => setP("faculty", e.target.value)} />
            </Field>
            <Field label="Degree program">
              <Input value={profile.program} onChange={(e) => setP("program", e.target.value)} />
            </Field>
            <Field label="Year of study">
              <Select value={profile.yearOfStudy} onChange={(e) => setP("yearOfStudy", e.target.value)}>
                <option value="">—</option>
                {["First Year", "Second Year", "Third Year", "Fourth Year", "Fifth Year", "Graduate"].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </Select>
            </Field>
            <Field label="Expected graduation">
              <Input value={profile.expectedGraduation} onChange={(e) => setP("expectedGraduation", e.target.value)} placeholder="April 2030" />
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <Button variant="primary" onClick={saveProfile} disabled={JSON.stringify(profile) === JSON.stringify(settings.profile)}>
              Save profile
            </Button>
          </div>
        </Card>
      </Section>

      <Section id="academic" icon={GraduationCap} title="Academic" description="Semesters bound recurring classes. The passing grade and scale drive the Grade Tracker.">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Semesters</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const s: Semester = { id: uid("sem"), name: "New semester", startDate: format(new Date(), "yyyy-MM-dd"), endDate: format(new Date(Date.now() + 110 * 864e5), "yyyy-MM-dd") };
                updateSettings({ semesters: [...settings.semesters, s], currentSemesterId: settings.currentSemesterId ?? s.id });
              }}
            >
              <Plus /> Add semester
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {settings.semesters.map((s) => (
              <div key={s.id} className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl border border-line p-2 md:grid-cols-[auto_1fr_150px_150px_auto]">
                <input type="radio" name="current-sem" checked={settings.currentSemesterId === s.id} onChange={() => updateSettings({ currentSemesterId: s.id })} aria-label={`Make ${s.name} current`} className="accent-[var(--accent)]" />
                <Input value={s.name} onChange={(e) => setSemester(s.id, { name: e.target.value })} className="h-8" aria-label="Semester name" />
                <Input type="date" value={s.startDate} onChange={(e) => setSemester(s.id, { startDate: e.target.value })} className="h-8" aria-label="Start date" />
                <Input type="date" value={s.endDate} onChange={(e) => setSemester(s.id, { endDate: e.target.value })} className="h-8" aria-label="End date" />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete semester"
                  onClick={async () => {
                    if (await confirm({ title: `Delete ${s.name}?`, body: "Courses in this semester become unassigned. Nothing else is deleted.", confirmLabel: "Delete", destructive: true })) {
                      updateSettings({ semesters: settings.semesters.filter((x) => x.id !== s.id), currentSemesterId: settings.currentSemesterId === s.id ? null : settings.currentSemesterId });
                    }
                  }}
                >
                  <Trash2 className="!size-3.5" />
                </Button>
              </div>
            ))}
            {!settings.semesters.length && <p className="text-xs text-faint">No semesters yet.</p>}
          </div>
          <p className="mt-2 text-[11px] text-faint">The selected semester is shown on the dashboard as the current one.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Passing grade (%)">
              <Input type="number" min={0} max={100} value={settings.passingGrade} onChange={(e) => updateSettings({ passingGrade: Math.max(0, Math.min(100, Number(e.target.value))) })} />
            </Field>
            <Field label="Week starts on">
              <Select value={settings.weekStartsOn} onChange={(e) => updateSettings({ weekStartsOn: Number(e.target.value) as 0 | 1 })}>
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </Select>
            </Field>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Grading scale</span>
              <Button size="sm" variant="ghost" onClick={() => updateSettings({ gradingScale: UBC_SCALE })}>
                <RotateCcw /> UBC default
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {[...settings.gradingScale]
                .sort((a, b) => b.min - a.min)
                .map((b, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-xl border border-line px-2 py-1.5">
                    <input
                      value={b.label}
                      onChange={(e) => updateSettings({ gradingScale: settings.gradingScale.map((x) => (x === b ? { ...x, label: e.target.value } : x)) })}
                      className="num w-8 bg-transparent text-xs text-ink focus:outline-none"
                      aria-label="Letter"
                    />
                    <span className="text-[10px] text-faint">≥</span>
                    <input
                      type="number"
                      value={b.min}
                      onChange={(e) => updateSettings({ gradingScale: settings.gradingScale.map((x) => (x === b ? { ...x, min: Number(e.target.value) } : x)) })}
                      className="num w-10 bg-transparent text-xs text-ink focus:outline-none"
                      aria-label={`Minimum for ${b.label}`}
                    />
                  </div>
                ))}
            </div>
          </div>
        </Card>
      </Section>

      <Section id="appearance" icon={Palette} title="Appearance" description="Theme, accent colour, sidebar and which widgets appear on the Overview.">
        <Card className="px-5 py-1">
          <Row label="Theme">
            <Segmented<ThemeMode>
              label="Theme"
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </Row>
          <Row label="Accent colour" hint="Selected states and positive indicators">
            <div className="flex gap-2">
              {(
                [
                  ["sage", "#879486"],
                  ["terracotta", "#b87961"],
                  ["navy", "#18242b"],
                ] as [AccentColour, string][]
              ).map(([a, hex]) => (
                <button key={a} onClick={() => updateSettings({ accent: a })} aria-label={a} aria-pressed={settings.accent === a} className={cn("size-7 rounded-full border-2", settings.accent === a ? "border-ink" : "border-transparent")} style={{ background: hex }} />
              ))}
            </div>
          </Row>
          <Row label="Compact sidebar" hint="Icons only on large screens">
            <Toggle checked={settings.sidebarCollapsed} onChange={(v) => updateSettings({ sidebarCollapsed: v })} label="Compact sidebar" />
          </Row>
          {DASHBOARD_WIDGETS.map((w) => (
            <Row key={w} label={WIDGET_LABEL[w]} hint="Overview widget">
              <Toggle checked={settings.dashboardWidgets[w]} onChange={(v) => updateSettings({ dashboardWidgets: { ...settings.dashboardWidgets, [w]: v } })} label={WIDGET_LABEL[w]} />
            </Row>
          ))}
        </Card>
      </Section>

      <Section id="notifications" icon={Bell} title="Notifications" description="Reminders appear while UniOS is open in a tab. Reminders when the app is closed need the future account sync (push service).">
        <Card className="px-5 py-1">
          <Row label="Browser notifications" hint={notifPerm === "granted" ? "Allowed" : notifPerm === "denied" ? "Blocked in browser settings; in-app toasts still show" : notifPerm === "unsupported" ? "Not supported in this browser" : "Show system notifications as well as in-app toasts"}>
            <Toggle
              checked={settings.notifications.enabled && notifPerm === "granted"}
              label="Browser notifications"
              onChange={async (v) => {
                if (v && typeof Notification !== "undefined" && Notification.permission === "default") {
                  const p = await Notification.requestPermission();
                  setNotifPerm(p);
                  if (p !== "granted") return toast.info("Notifications were not allowed");
                }
                updateSettings({ notifications: { ...settings.notifications, enabled: v } });
              }}
            />
          </Row>
          <Row label="Assignment reminders" hint="Before each deadline">
            <div className="flex items-center gap-3">
              <Select
                value={settings.notifications.assignmentLeadHours}
                onChange={(e) => updateSettings({ notifications: { ...settings.notifications, assignmentLeadHours: Number(e.target.value) } })}
                className="h-8 w-auto text-xs"
                aria-label="Reminder lead time"
              >
                {[2, 6, 12, 24, 48, 72].map((h) => (
                  <option key={h} value={h}>
                    {h < 24 ? `${h} hours` : `${h / 24} day${h > 24 ? "s" : ""}`} before
                  </option>
                ))}
              </Select>
              <Toggle checked={settings.notifications.assignmentReminders} onChange={(v) => updateSettings({ notifications: { ...settings.notifications, assignmentReminders: v } })} label="Assignment reminders" />
            </div>
          </Row>
          <Row label="Upcoming exams" hint="Uses each exam’s reminder time">
            <Toggle checked={settings.notifications.examReminders} onChange={(v) => updateSettings({ notifications: { ...settings.notifications, examReminders: v } })} label="Exam reminders" />
          </Row>
          <Row label="Calendar reminders" hint="Uses each event’s reminder time">
            <Toggle checked={settings.notifications.calendarReminders} onChange={(v) => updateSettings({ notifications: { ...settings.notifications, calendarReminders: v } })} label="Calendar reminders" />
          </Row>
          <Row label="Daily planning reminder">
            <div className="flex items-center gap-3">
              <Input type="time" value={settings.notifications.dailyPlanningTime} onChange={(e) => updateSettings({ notifications: { ...settings.notifications, dailyPlanningTime: e.target.value } })} className="h-8 w-28" aria-label="Daily planning time" />
              <Toggle checked={settings.notifications.dailyPlanning} onChange={(v) => updateSettings({ notifications: { ...settings.notifications, dailyPlanning: v } })} label="Daily planning reminder" />
            </div>
          </Row>
        </Card>
      </Section>

      <Section id="canvas" icon={Link2} title="Canvas" description="Bring courses, assignments, due dates, weights and grades in from Canvas. Works without an access token.">
        <CanvasSettings />
      </Section>

      <Section id="data" icon={Database} title="Data" description="Everything is stored in this browser on this device. Export regularly to keep a backup or move to another device.">
        <Card className="px-5 py-1">
          <Row label="Export data" hint="All courses, assignments, grades, events, sessions and notes as JSON">
            <Button size="sm" onClick={() => exportData("export")}>
              <Download /> Export
            </Button>
          </Row>
          <Row label="Back up now" hint="Same file, named as a dated backup">
            <Button size="sm" onClick={() => exportData("backup")}>
              <Download /> Backup
            </Button>
          </Row>
          <Row label="Import data" hint="Replace everything with a UniOS export file">
            <>
              <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0]).finally(() => (e.target.value = ""))} />
              <Button size="sm" onClick={() => fileInput.current?.click()}>
                <Upload /> Import
              </Button>
            </>
          </Row>
          <Row label="Demonstration data" hint={demoCount ? `${demoCount} sample records for a UBCO engineering student` : "No demo records present"}>
            {demoCount ? (
              <Button
                size="sm"
                onClick={async () => {
                  if (await confirm({ title: "Remove demo data?", body: "All records marked DEMO are deleted. Anything you created or edited stays (edited demo items are still marked demo and will be removed).", confirmLabel: "Remove demo data", destructive: true })) {
                    removeDemoData();
                    toast.success("Demo data removed");
                  }
                }}
              >
                <Trash2 /> Remove demo data
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  loadDemoData();
                  toast.success("Demo data added");
                }}
              >
                <Plus /> Load demo data
              </Button>
            )}
          </Row>
          <Row label="Reset UniOS" hint="Delete all data and settings from this browser">
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                if (await confirm({ title: "Reset all data?", body: "Every course, assignment, grade, event, note, file and setting is permanently deleted from this browser. This cannot be undone.", confirmLabel: "Delete everything", destructive: true })) {
                  await reset();
                  setProfile(useStore.getState().data.settings.profile);
                  toast.success("UniOS has been reset");
                }
              }}
            >
              Reset
            </Button>
          </Row>
        </Card>
      </Section>
    </div>
  );
}
