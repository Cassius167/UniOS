-- UniOS · Postgres schema for the multi-user phase (Supabase).
-- Mirrors src/lib/types.ts. Every table is owned by a user and protected by
-- Row Level Security so students can only ever see their own rows.
-- Not used by the app yet: the current build stores data in the browser.

create extension if not exists "pgcrypto";

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  settings jsonb not null default '{}'::jsonb,       -- Settings (profile, scale, theme…)
  updated_at timestamptz not null default now()
);

create table public.courses (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  code text not null, name text not null, instructor text not null default '',
  semester_id text, description text not null default '', office_hours text not null default '',
  website text not null default '', tone text not null default 'sage', credits numeric,
  target_grade numeric, drop_rules jsonb not null default '[]', archived boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.assessments (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  course_id text not null references public.courses on delete cascade,
  name text not null, category text not null default '', weight numeric not null check (weight >= 0),
  score numeric, max_score numeric not null default 100 check (max_score > 0),
  date date, is_bonus boolean not null default false, excused boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.assignments (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  course_id text references public.courses on delete cascade,
  title text not null, description text not null default '', due_at timestamptz not null,
  type text not null, estimated_hours numeric, priority text not null, grade_weight numeric,
  status text not null, submission text not null, subtasks jsonb not null default '[]',
  completed_at timestamptz, is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.events (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  course_id text references public.courses on delete cascade,
  title text not null, type text not null, start_at timestamptz not null, end_at timestamptz not null,
  all_day boolean not null default false, location text not null default '', description text not null default '',
  recurrence jsonb, exceptions jsonb not null default '[]', reminder_minutes int,
  source text not null default 'local', external_id text,      -- for Google Calendar sync
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.study_sessions (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  course_id text references public.courses on delete set null,
  assignment_id text references public.assignments on delete set null,
  task text not null default '', kind text not null, started_at timestamptz not null,
  planned_minutes int not null, actual_minutes int not null, rating int check (rating between 1 and 5),
  reflection text not null default '', distractions jsonb not null default '[]',
  is_demo boolean not null default false, created_at timestamptz not null default now()
);

create table public.folders (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null, created_at timestamptz not null default now()
);

create table public.notes (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  course_id text references public.courses on delete set null,
  folder_id text references public.folders on delete set null,
  title text not null default '', content text not null default '', tags text[] not null default '{}',
  starred boolean not null default false, is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.resources (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  course_id text references public.courses on delete cascade,
  title text not null, kind text not null, category text not null default 'General',
  url text, storage_path text,              -- Supabase Storage object: <user_id>/<id>/<file>
  file_name text, file_size bigint, mime_type text, description text not null default '',
  is_demo boolean not null default false, created_at timestamptz not null default now()
);

-- Row Level Security: owner-only access on every table.
do $$
declare t text;
begin
  foreach t in array array['courses','assessments','assignments','events','study_sessions','folders','notes','resources'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s_owner_select" on public.%1$I for select using (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_owner_insert" on public.%1$I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_owner_update" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_owner_delete" on public.%1$I for delete using (auth.uid() = user_id)', t);
    execute format('create index on public.%I (user_id)', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy "profiles_owner_all" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private storage bucket for resource files; objects live under the owner's id.
insert into storage.buckets (id, name, public) values ('resources', 'resources', false) on conflict do nothing;
create policy "resources_owner_rw" on storage.objects for all
  using (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);
