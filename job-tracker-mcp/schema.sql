-- Paste once in Supabase → SQL Editor → Run (fresh install).
-- Service role (Worker) bypasses RLS. Do not put the service role key in a browser UI.
-- Existing DBs: use schema-migration-002-users.sql instead of re-running this wholesale.

create table if not exists public.users (
  user_id text primary key,
  name text not null,
  persona_json jsonb not null default '{}'::jsonb,
  role text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (user_id)
    on update cascade on delete restrict,
  job_url text not null,
  title text not null,
  company text not null,
  location text not null default '',
  country text not null default '',
  region text check (region in ('europe', 'oceania', 'asia', 'me', 'other')),
  source text not null default '',
  visa_sponsorship text not null default 'unknown'
    check (visa_sponsorship in ('yes', 'no', 'unknown', 'likely')),
  visa_notes text not null default '',
  salary text not null default '',
  work_mode text not null default 'unknown'
    check (work_mode in ('onsite', 'hybrid', 'remote', 'unknown')),
  description_snippet text not null default '',
  status text not null default 'discovered'
    check (status in (
      'discovered', 'interested', 'applied', 'interviewing',
      'selected', 'rejected', 'offer', 'withdrawn'
    )),
  discovered_date date not null default (current_date),
  status_date date not null default (current_date),
  applied_date date,
  notes text not null default '',
  outreach_message text not null default '',
  follow_up_date date,
  last_updated date not null default (current_date),
  created_at timestamptz not null default now()
);

create unique index if not exists jobs_user_job_url_uidx on public.jobs (user_id, job_url);

create unique index if not exists jobs_user_fingerprint_uidx on public.jobs (
  user_id,
  lower(trim(company)),
  lower(trim(title)),
  lower(trim(location))
);

create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_region_idx on public.jobs (region);
create index if not exists jobs_user_id_idx on public.jobs (user_id);

create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (user_id)
    on update cascade on delete restrict,
  query text not null,
  region text,
  results_count int not null default 0,
  new_jobs_added int not null default 0,
  skipped_duplicates int not null default 0,
  run_date date not null default (current_date),
  created_at timestamptz not null default now()
);

create index if not exists search_runs_user_id_idx on public.search_runs (user_id);

alter table public.users enable row level security;
alter table public.jobs enable row level security;
alter table public.search_runs enable row level security;

notify pgrst, 'reload schema';
