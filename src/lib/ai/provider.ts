/**
 * Server-only AI provider configuration.
 *
 * The study assistant is intentionally NOT implemented with canned answers.
 * When a key is configured, a route handler in app/api/ai/* will call the
 * provider from the server so the key never reaches the browser.
 *
 *   ANTHROPIC_API_KEY=sk-ant-...      (in .env.local, never NEXT_PUBLIC_)
 *   UNIOS_AI_MODEL=claude-sonnet-5-5  (optional)
 */
import "server-only";

export interface AiStatus {
  configured: boolean;
  provider: "anthropic" | null;
  model: string | null;
}

export function aiStatus(): AiStatus {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? { configured: true, provider: "anthropic", model: process.env.UNIOS_AI_MODEL ?? "claude-sonnet-5-5" } : { configured: false, provider: null, model: null };
}
