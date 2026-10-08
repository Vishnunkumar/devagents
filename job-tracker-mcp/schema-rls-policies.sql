-- Run after schema.sql if the Worker uses publishable/anon key (not service_role).
-- Personal tracker only — tighten when you add Supabase Auth.

drop policy if exists "jobs_tracker_all" on public.jobs;
create policy "jobs_tracker_all"
  on public.jobs
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "search_runs_tracker_all" on public.search_runs;
create policy "search_runs_tracker_all"
  on public.search_runs
  for all
  to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
