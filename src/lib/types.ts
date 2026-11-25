/**
 * UniOS data models.
 *
 * These types are the contract between the UI and the data layer. They are
 * deliberately storage-agnostic: every record has a string `id` and ISO
 * timestamps so the same shapes map 1:1 onto Postgres rows (see
 * supabase/schema.sql) when the app moves to a multi-user backend.
 *
 * Date conventions
 *   - Instants (event start, due date-time): full ISO strings, e.g. "2026-11-24T09:30:00.000Z"
 *   - Calendar days without time (semester start, note dates): "yyyy-MM-dd"
 */

export type ID = string;

/** Link to a record in an external system (e.g. Canvas), used to merge re-imports. */
export interface ExternalRef {
  source: "canvas";
  id: string;
}

/* ─────────────────────────── Settings ─────────────────────────── */

export interface Profile {
  name: string;
  university: string;
  faculty: string;
  program: string;
  yearOfStudy: string;
  expectedGraduation: string; // free text, e.g. "April 2030"
}

export interface Semester {
  id: ID;
  name: string; // "Winter Semester 2026"
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
}

export interface GradeBand {
  label: string; // "A+"
  min: number; // inclusive lower bound, percent
}

export type ThemeMode = "light" | "dark" | "system";
export type AccentColour = "sage" | "terracotta" | "navy";

export const DASHBOARD_WIDGETS = [
  "today",
  "schedule",
  "priority",
  "deadlines",
  "courses",
  "productivity",
] as const;
export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number];

export interface NotificationSettings {
  enabled: boolean; // master switch for browser notifications
  assignmentReminders: boolean;
  assignmentLeadHours: number;
  examReminders: boolean;
  calendarReminders: boolean;
  dailyPlanning: boolean;
  dailyPlanningTime: string; // "08:00"
}

export interface FocusSettings {
  pomodoro: number; // minutes
  deep: number;
  shortBreak: number;
  longBreak: number;
}

export interface CanvasSettings {
  /** Private Canvas calendar feed (.ics) URL. Stored only in this browser. */
  feedUrl: string;
  autoSync: boolean;
  lastFeedSync: string | null;
  lastImport: string | null;
}

export interface Settings {
  profile: Profile;
  semesters: Semester[];
  currentSemesterId: ID | null;
  passingGrade: number; // percent
  gradingScale: GradeBand[];
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  theme: ThemeMode;
  accent: AccentColour;
  sidebarCollapsed: boolean;
  dashboardWidgets: Record<DashboardWidget, boolean>;
  notifications: NotificationSettings;
  focus: FocusSettings;
  canvas: CanvasSettings;
}

/* ─────────────────────────── Courses ─────────────────────────── */

/** Restrained palette keys used to tint courses. Resolved in lib/palette.ts */
export type CourseTone =
  | "sage"
  | "terra"
  | "navy"
  | "ochre"
  | "slate"
  | "moss"
  | "clay"
  | "stone";

export interface Course {
  id: ID;
  code: string; // "APSC 171"
  name: string;
  instructor: string;
  semesterId: ID | null;
  description: string;
  officeHours: string;
  website: string;
  tone: CourseTone;
  credits: number | null;
  targetGrade: number | null; // percent
  /** Drop-lowest rules per assessment category, only applied when configured. */
  dropRules: DropRule[];
  archived: boolean;
  external?: ExternalRef | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DropRule {
  category: string; // matches Assessment.category
  dropLowest: number;
}

/* ─────────────────────────── Grades ─────────────────────────── */

export interface Assessment {
  id: ID;
  courseId: ID;
  name: string;
  category: string; // "Labs", "Midterms" … used for drop rules & grouping
  weight: number; // percent of the final course grade
  /** Raw score achieved. null = not graded yet (never treated as zero). */
  score: number | null;
  maxScore: number; // 100 for percentage entry
  date: string | null; // yyyy-MM-dd
  isBonus: boolean; // adds to the grade without adding to the denominator
  /** Excused items are removed from the grading structure entirely. */
  excused: boolean;
  external?: ExternalRef | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ─────────────────────────── Assignments ─────────────────────────── */

export const ASSIGNMENT_TYPES = [
  "homework",
  "lab",
  "project",
  "essay",
  "report",
  "presentation",
  "quiz",
  "exam",
  "other",
] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ASSIGNMENT_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const SUBMISSION_STATUSES = ["not_submitted", "submitted", "graded"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
  dueDate: string | null; // yyyy-MM-dd
  priority: Priority;
  estimatedMinutes: number | null;
}

export interface Assignment {
  id: ID;
  courseId: ID | null;
  title: string;
  description: string;
  dueAt: string; // ISO instant
  type: AssignmentType;
  estimatedHours: number | null;
  priority: Priority;
  gradeWeight: number | null; // percent of course
  status: AssignmentStatus;
  submission: SubmissionStatus;
  subtasks: Subtask[];
  completedAt: string | null;
  /** Link back to the source (e.g. the Canvas assignment page). */
  url?: string | null;
  external?: ExternalRef | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ─────────────────────────── Calendar ─────────────────────────── */

export const EVENT_TYPES = [
  "lecture",
  "lab",
  "tutorial",
  "exam",
  "deadline",
  "study",
  "personal",
  "meeting",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface Recurrence {
  freq: "daily" | "weekly";
  interval: number; // every N days/weeks
  byWeekday: number[]; // 0–6 (Sun–Sat), weekly only
  until: string | null; // yyyy-MM-dd inclusive
}

export interface CalendarEvent {
  id: ID;
  title: string;
  type: EventType;
  courseId: ID | null;
  start: string; // ISO instant of the first occurrence
  end: string; // ISO instant
  allDay: boolean;
  location: string;
  description: string;
  recurrence: Recurrence | null;
  /** Occurrence dates (yyyy-MM-dd) removed from a recurring series. */
  exceptions: string[];
  reminderMinutes: number | null;
  /** Where the event came from — lets a Google Calendar sync coexist later. */
  source: "local" | "google" | "canvas";
  externalId: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ─────────────────────────── Focus ─────────────────────────── */

export const SESSION_KINDS = ["pomodoro", "deep", "custom"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export const DISTRACTION_KINDS = ["phone", "websites", "unrelated", "focus", "other"] as const;
export type DistractionKind = (typeof DISTRACTION_KINDS)[number];

export interface Distraction {
  id: ID;
  kind: DistractionKind;
  at: string; // ISO
  note: string;
}

export interface StudySession {
  id: ID;
  courseId: ID | null;
  assignmentId: ID | null;
  task: string;
  kind: SessionKind;
  startedAt: string; // ISO
  plannedMinutes: number;
  actualMinutes: number; // time actually focused (pauses excluded)
  rating: number | null; // 1–5
  reflection: string;
  distractions: Distraction[];
  isDemo: boolean;
  createdAt: string;
}

/* ─────────────────────────── Notes & resources ─────────────────────────── */

export interface Folder {
  id: ID;
  name: string;
  createdAt: string;
}

export interface Note {
  id: ID;
  title: string;
  content: string; // sanitized HTML
  courseId: ID | null;
  folderId: ID | null;
  tags: string[];
  starred: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export const RESOURCE_KINDS = ["link", "pdf", "document", "slides", "image", "other"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export interface Resource {
  id: ID;
  title: string;
  kind: ResourceKind;
  courseId: ID | null;
  category: string;
  url: string | null; // external link
  /** Uploaded file stored in IndexedDB under this key (see lib/data/files.ts). */
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  description: string;
  isDemo: boolean;
  createdAt: string;
}

/* ─────────────────────────── Root document ─────────────────────────── */

export interface AppData {
  schemaVersion: number;
  settings: Settings;
  courses: Course[];
  assessments: Assessment[];
  assignments: Assignment[];
  events: CalendarEvent[];
  sessions: StudySession[];
  notes: Note[];
  folders: Folder[];
  resources: Resource[];
}

export type CollectionKey = Exclude<keyof AppData, "schemaVersion" | "settings">;
