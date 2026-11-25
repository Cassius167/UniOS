import type { AppData } from "../types";
import type { DataRepository } from "./repository";
import { migrate } from "./migrations";

const KEY = "unios:data";
const BACKUP_KEY = "unios:data:previous";

export class LocalRepository implements DataRepository {
  readonly kind = "local" as const;

  async load(): Promise<AppData | null> {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return migrate(JSON.parse(raw));
    } catch (err) {
      // Corrupt payload: keep it aside instead of silently losing it.
      window.localStorage.setItem(`${KEY}:corrupt:${Date.now()}`, raw);
      throw new Error(`Saved data could not be read (${(err as Error).message}). A copy was kept in local storage.`);
    }
  }

  async save(data: AppData): Promise<void> {
    if (typeof window === "undefined") return;
    const raw = JSON.stringify(data);
    try {
      const prev = window.localStorage.getItem(KEY);
      if (prev) window.localStorage.setItem(BACKUP_KEY, prev);
      window.localStorage.setItem(KEY, raw);
    } catch (err) {
      if (err instanceof DOMException && err.name === "QuotaExceededError") {
        window.localStorage.removeItem(BACKUP_KEY);
        window.localStorage.setItem(KEY, raw);
        return;
      }
      throw err;
    }
  }

  async clear(): Promise<void> {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(BACKUP_KEY);
  }
}
