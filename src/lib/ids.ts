/** Collision-resistant id that works in browsers and Node without dependencies. */
export function uid(prefix = ""): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

export const nowIso = () => new Date().toISOString();
