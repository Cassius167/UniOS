import type { AppData } from "../types";
import { SCHEMA_VERSION, defaultSettings, emptyData } from "./defaults";

/**
 * Brings any stored or imported payload up to the current schema.
 * Add a step here whenever a model changes shape; never mutate old data in place.
 */
export function migrate(input: unknown): AppData {
  if (!input || typeof input !== "object") throw new Error("Not a UniOS data file");
  const raw = input as Partial<AppData> & { schemaVersion?: number };
  if (typeof raw.schemaVersion !== "number") throw new Error("Missing schemaVersion");
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`This file was made by a newer version of UniOS (schema ${raw.schemaVersion}).`);
  }

  const base = emptyData();
  const defaults = defaultSettings();
  const settings = { ...defaults, ...(raw.settings ?? {}) };
  settings.profile = { ...defaults.profile, ...(raw.settings?.profile ?? {}) };
  settings.notifications = { ...defaults.notifications, ...(raw.settings?.notifications ?? {}) };
  settings.focus = { ...defaults.focus, ...(raw.settings?.focus ?? {}) };
  settings.canvas = { ...defaults.canvas, ...(raw.settings?.canvas ?? {}) };
  settings.dashboardWidgets = { ...defaults.dashboardWidgets, ...(raw.settings?.dashboardWidgets ?? {}) };

  const arr = <K extends keyof AppData>(k: K) => (Array.isArray(raw[k]) ? raw[k] : base[k]) as AppData[K];

  return {
    schemaVersion: SCHEMA_VERSION,
    settings,
    courses: arr("courses"),
    assessments: arr("assessments"),
    assignments: arr("assignments"),
    events: arr("events"),
    sessions: arr("sessions"),
    notes: arr("notes"),
    folders: arr("folders"),
    resources: arr("resources"),
  };
}
