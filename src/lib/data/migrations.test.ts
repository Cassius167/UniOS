import { describe, expect, it } from "vitest";
import { migrate } from "./migrations";
import { SCHEMA_VERSION } from "./defaults";

describe("migrate", () => {
  it("moves the old default 'system' theme to light", () => {
    const out = migrate({ schemaVersion: 1, settings: { theme: "system" } });
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.settings.theme).toBe("light");
  });
  it("keeps an explicit dark theme", () => {
    expect(migrate({ schemaVersion: 1, settings: { theme: "dark" } }).settings.theme).toBe("dark");
  });
  it("leaves a v2 'system' choice alone", () => {
    expect(migrate({ schemaVersion: 2, settings: { theme: "system" } }).settings.theme).toBe("system");
  });
});
