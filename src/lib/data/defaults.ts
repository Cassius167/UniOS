import type { AppData, GradeBand, Settings } from "../types";

export const SCHEMA_VERSION = 2;

/** UBC percentage-to-letter scale. Editable in Settings → Academic. */
export const UBC_SCALE: GradeBand[] = [
  { label: "A+", min: 90 },
  { label: "A", min: 85 },
  { label: "A-", min: 80 },
  { label: "B+", min: 76 },
  { label: "B", min: 72 },
  { label: "B-", min: 68 },
  { label: "C+", min: 64 },
  { label: "C", min: 60 },
  { label: "C-", min: 55 },
  { label: "D", min: 50 },
  { label: "F", min: 0 },
];

export function defaultSettings(): Settings {
  return {
    profile: {
      name: "",
      university: "",
      faculty: "",
      program: "",
      yearOfStudy: "",
      expectedGraduation: "",
    },
    semesters: [],
    currentSemesterId: null,
    passingGrade: 50,
    gradingScale: UBC_SCALE,
    weekStartsOn: 1,
    theme: "light",
    accent: "sage",
    sidebarCollapsed: false,
    dashboardWidgets: {
      today: true,
      schedule: true,
      priority: true,
      deadlines: true,
      courses: true,
      productivity: true,
    },
    notifications: {
      enabled: false,
      assignmentReminders: true,
      assignmentLeadHours: 24,
      examReminders: true,
      calendarReminders: true,
      dailyPlanning: false,
      dailyPlanningTime: "08:00",
    },
    focus: { pomodoro: 25, deep: 50, shortBreak: 5, longBreak: 15 },
    canvas: { feedUrl: "", autoSync: true, lastFeedSync: null, lastImport: null },
  };
}

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    courses: [],
    assessments: [],
    assignments: [],
    events: [],
    sessions: [],
    notes: [],
    folders: [],
    resources: [],
  };
}
