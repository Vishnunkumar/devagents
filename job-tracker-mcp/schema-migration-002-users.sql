-- Run in Supabase SQL Editor AFTER schema.sql (existing JobTracker DB).
-- Adds public.users, user_id on jobs + search_runs, per-user dedupe indexes.

create table if not exists public.users (
  user_id text primary key,
  name text not null,
  persona_json jsonb not null default '{}'::jsonb,
  role text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.users (user_id, name, role)
values (
  'vishnu-backend',
  'Vishnu Nandakumar — Backend / Payments',
  'backend'
)
on conflict (user_id) do nothing;

-- jobs.user_id
alter table public.jobs add column if not exists user_id text;

update public.jobs
set user_id = 'vishnu-backend'
where user_id is null;

alter table public.jobs alter column user_id set not null;

alter table public.jobs drop constraint if exists jobs_user_id_fkey;
alter table public.jobs
  add constraint jobs_user_id_fkey
  foreign key (user_id) references public.users (user_id)
  on update cascade
  on delete restrict;

drop index if exists public.jobs_job_url_uidx;
drop index if exists public.jobs_fingerprint_uidx;

create unique index if not exists jobs_user_job_url_uidx
  on public.jobs (user_id, job_url);

create unique index if not exists jobs_user_fingerprint_uidx on public.jobs (
  user_id,
  lower(trim(company)),
  lower(trim(title)),
  lower(trim(location))
);

create index if not exists jobs_user_id_idx on public.jobs (user_id);

-- search_runs.user_id
alter table public.search_runs add column if not exists user_id text;

update public.search_runs
set user_id = 'vishnu-backend'
where user_id is null;

alter table public.search_runs alter column user_id set not null;

alter table public.search_runs drop constraint if exists search_runs_user_id_fkey;
alter table public.search_runs
  add constraint search_runs_user_id_fkey
  foreign key (user_id) references public.users (user_id)
  on update cascade
  on delete restrict;

create index if not exists search_runs_user_id_idx on public.search_runs (user_id);

alter table public.users enable row level security;

notify pgrst, 'reload schema';
