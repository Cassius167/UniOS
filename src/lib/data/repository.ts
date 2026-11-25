/**
 * Data repository contract.
 *
 * The UI only ever talks to the zustand store (lib/store.ts), and the store
 * only ever talks to a DataRepository. Today that is LocalRepository
 * (browser localStorage). A SupabaseRepository can implement the same
 * interface later — see supabase/README.md — without touching any page.
 */
import type { AppData } from "../types";

export interface DataRepository {
  readonly kind: "local" | "supabase";
  /** Returns null when no data exists yet (first run). */
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
  clear(): Promise<void>;
}
