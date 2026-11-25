# UniOS — University Operating System

A personal command centre for university: schedule, assignments, grades, focus sessions, notes and analytics in one place.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

| Command | What it does |
|---|---|
| `npm test` | Unit tests (grade engine, recurrence, assignment ranking) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build && npm start` | Production build |

No environment variables are required. On first launch UniOS loads clearly-labelled **demo data** for a sample first-year UBCO engineering student. Remove it in **Settings → Data → Remove demo data**.

### Optional: AI assistant key (Phase 4, not built yet)

Create `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The Study Assistant page will report "Key detected". The key is read only on the server (`src/lib/ai/provider.ts`, `server-only`) and never reaches browser code.

## Where data lives

Everything is stored **in your browser** (localStorage for records, IndexedDB for uploaded files). It persists across refreshes and restarts, but is per-browser and per-device. Use **Settings → Data → Export / Backup** regularly. Import restores a backup.

## Architecture

```
src/
  app/                    Next.js App Router pages (one folder per section)
    api/ai/status/        Server route: reports AI configuration, never the key
  components/
    ui/                   Design-system primitives, modal, confirm dialog, toasts
    shell/                Sidebar, top bar, quick-add, search (⌘K), theme, reminders, focus pill
    forms/                Assignment / event / course / assessment forms (React Hook Form + Zod)
    notes/, resources.tsx Rich-text editor and resource library
    domain.tsx, charts.tsx Shared rows, tags, Recharts wrappers
  lib/
    types.ts              Data models (storage-agnostic, map 1:1 to supabase/schema.sql)
    store.ts              Zustand store + typed CRUD, debounced persistence
    data/                 Repository interface, LocalRepository, migrations, defaults, demo seed, file store
    grades/engine.ts      Grade calculation engine (pure, fully tested)
    calendar/recurrence.ts Recurring event expansion (tested)
    assignments/priority.ts Attention score for "suggested order" (tested)
    analytics.ts          All statistics, derived only from stored records
supabase/schema.sql       Postgres tables + Row Level Security for the multi-user phase
```

### Moving to Supabase (Phase 5)

1. Create a Supabase project and run `supabase/schema.sql` (tables, owner-only RLS policies, private storage bucket).
2. Implement `SupabaseRepository` against the `DataRepository` interface in `src/lib/data/repository.ts` and swap it in `src/lib/store.ts`.
3. Add Supabase Auth; env vars will be `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to expose: RLS enforces isolation). Never expose the service-role key.

## Canvas

Settings → Canvas has two connections, neither needs an access token:

- **Calendar feed**: paste the Canvas *Calendar Feed* link. UniOS fetches it through `/api/canvas/feed` (server-side, CORS) when it opens and every 30 minutes, creating/updating assignments and Canvas events.
- **Export bookmark**: a bookmarklet run on Canvas while signed in. It reads `/api/v1/courses` and `assignment_groups` with your existing session and downloads `canvas-export-*.json`, which UniOS imports with a preview. Records are matched by Canvas id, so re-imports update instead of duplicating.

Code: `src/lib/canvas/` (tested in `canvas.test.ts`).

## Grade calculation rules

- Ungraded assessments are never zero. "Mark as zero" in the form is the explicit way to record a missed item.
- **Average on completed work** = points earned ÷ graded weight. **Course percentage earned so far** = points earned ÷ 100.
- Bonus items add points without adding weight. Excused items are removed.
- Drop-lowest rules apply only when configured per category; kept items share the category weight equally.
- If weights exceed 100%, grades are computed out of the total and a warning is shown.
- Targets report *secured*, *achievable (needs X%)*, or *not possible (would need X%)*.
- No rounding inside the engine; display rounds half away from zero. "Explain the calculation" shows every step.

## Feature status

| Area | Status |
|---|---|
| Design system, light/dark mode, accents, responsive layout | Done |
| Overview dashboard (all widgets live, customisable) | Done |
| Courses + per-course workspace (overview, assignments, grades, notes, resources, sessions) | Done |
| Assignments: create/edit/delete, subtasks + templates, filters, sort, views, Kanban, suggested order | Done |
| Calendar: month/week/day, recurring events, per-occurrence edit/delete, drag to reschedule, quick add, reminders | Done |
| Grade tracker: weights, raw/percent, targets, required-on-final, scenario sliders, outcome chart, drop rules, bonus | Done |
| Focus: Pomodoro/50-min/custom, breaks, pause/resume (survives reload), distractions, ratings, reflections | Done |
| Notes (rich text, folders, tags, stars, search) and resources (links + file uploads) | Done |
| Analytics: academic + productivity, weekly/monthly | Done |
| Settings: profile, semesters, scale, appearance, notifications, export/import/backup/reset | Done |
| Canvas: calendar feed auto-sync (due dates, events) and "Export to UniOS" bookmark (courses, weights, grades), merged without duplicates | Done (Settings → Canvas) |
| Browser notifications | While a UniOS tab is open only |
| AI assistant, document analysis | Not built (Phase 4); page shows honest status |
| Google Calendar sync | Not built; events carry `source`/`externalId` for it |
| Accounts, multi-user, sync across devices | Not built (Phase 5); schema + RLS ready |
