import { fingerprint, normalizeJobUrl } from "./normalize";
import type { DbJobRow } from "./schema";
import { rowToJob } from "./schema";
import type { Env, JobPatch, JobRecord, NewJob } from "./types";

const PAGE = 1000;

export class SupabaseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

export function supabaseUrl(env: Env): string {
  const raw = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || "";
  return raw.trim().replace(/\/$/, "");
}

export function supabaseKey(env: Env): string {
  return (
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
}

function requireEnv(env: Env) {
  if (!supabaseUrl(env)) {
    throw new Error(
      "Missing SUPABASE_URL or PUBLIC_SUPABASE_URL (e.g. https://xxxx.supabase.co)",
    );
  }
  if (!supabaseKey(env)) {
    throw new Error(
      "Missing Supabase API key: set SUPABASE_SERVICE_ROLE_KEY (Worker) or PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
}

function restBase(env: Env) {
  return `${supabaseUrl(env)}/rest/v1`;
}

function headers(env: Env, extra: Record<string, string> = {}): HeadersInit {
  const key = supabaseKey(env);
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function supabaseFetch(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  requireEnv(env);
  const res = await fetch(`${restBase(env)}${path}`, {
    ...init,
    headers: headers(env, init.headers as Record<string, string>),
  });
  return res;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function expectOk(res: Response): Promise<unknown> {
  const body = await parseJson(res);
  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: string }).message === "string"
        ? (body as { message: string }).message
        : `Supabase HTTP ${res.status}`;
    throw new SupabaseError(msg, res.status, body);
  }
  return body;
}

const JOB_COLUMNS =
  "id,job_url,title,company,location,country,region,source,visa_sponsorship,visa_notes,salary,work_mode,description_snippet,status,discovered_date,status_date,applied_date,notes,outreach_message,follow_up_date,last_updated";

const LIST_COLUMNS =
  "id,job_url,title,company,location,country,region,visa_sponsorship,work_mode,status,discovered_date,applied_date,salary,source";

export async function ensureSchema(env: Env) {
  const checks: { table: string; ok: boolean; hint?: string }[] = [];
  for (const table of ["jobs", "search_runs"]) {
    const res = await supabaseFetch(env, `/${table}?select=id&limit=1`);
    const body = await parseJson(res);
    if (res.ok) {
      checks.push({ table, ok: true });
      continue;
    }
    const hint =
      res.status === 404 || (typeof body === "object" && body !== null)
        ? "Run job-tracker-mcp/schema.sql in Supabase SQL Editor, then schema-rls-policies.sql if using publishable key."
        : undefined;
    checks.push({ table, ok: false, hint });
  }
  const allOk = checks.every((c) => c.ok);
  return {
    supabase_url: supabaseUrl(env),
    tables: checks,
    ready: allOk,
    note: allOk
      ? "Tables reachable. Schema is managed in Supabase SQL, not via this tool."
      : "Fix missing tables or RLS (see hints).",
  };
}

async function listJobRows(
  env: Env,
  filters: { status?: string; region?: string },
  columns: string,
): Promise<DbJobRow[]> {
  const out: DbJobRow[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams();
    params.set("select", columns);
    if (filters.status) params.set("status", `eq.${filters.status}`);
    if (filters.region) params.set("region", `eq.${filters.region}`);
    params.set("order", "discovered_date.desc");
    params.set("limit", String(PAGE));
    params.set("offset", String(offset));
    const res = await supabaseFetch(env, `/jobs?${params.toString()}`);
    const body = (await expectOk(res)) as DbJobRow[];
    out.push(...body);
    if (body.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

export async function listJobs(
  env: Env,
  filters: { status?: string; region?: string } = {},
): Promise<JobRecord[]> {
  const rows = await listJobRows(env, filters, LIST_COLUMNS);
  return rows.map((r) => rowToJob(r));
}

function jobInsertRow(job: NewJob, today: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    job_url: normalizeJobUrl(job.url),
    title: job.title.trim(),
    company: job.company.trim(),
    location: job.location?.trim() ?? "",
    country: job.country?.trim() ?? "",
    source: job.source?.trim() ?? "",
    visa_sponsorship: job.visa_sponsorship ?? "unknown",
    visa_notes: job.visa_notes?.slice(0, 2000) ?? "",
    salary: job.salary ?? "",
    work_mode: job.work_mode ?? "unknown",
    description_snippet: job.description_snippet?.slice(0, 1500) ?? "",
    status: "discovered",
    discovered_date: today,
    status_date: today,
    last_updated: today,
  };
  if (job.region) row.region = job.region;
  return row;
}

export async function createJobs(env: Env, jobs: NewJob[], today: string) {
  const existing = await listJobs(env);
  const urls = new Set(existing.map((j) => normalizeJobUrl(j.url)).filter(Boolean));
  const prints = new Set(
    existing
      .filter((j) => j.company && j.title)
      .map((j) => fingerprint(j.company, j.title, j.location)),
  );

  const skipped: { url: string; reason: string }[] = [];
  const toCreate: Record<string, unknown>[] = [];
  const seenBatch = new Set<string>();

  for (const job of jobs) {
    const url = normalizeJobUrl(job.url);
    const fp = fingerprint(job.company, job.title, job.location ?? "");
    if (!url || !job.title?.trim() || !job.company?.trim()) {
      skipped.push({ url: job.url, reason: "missing url, title, or company" });
      continue;
    }
    if (urls.has(url) || seenBatch.has(url)) {
      skipped.push({ url, reason: "duplicate url" });
      continue;
    }
    if (fp !== "||" && (prints.has(fp) || seenBatch.has(`fp:${fp}`))) {
      skipped.push({ url, reason: "duplicate company+title+location" });
      continue;
    }
    seenBatch.add(url);
    seenBatch.add(`fp:${fp}`);
    toCreate.push(jobInsertRow({ ...job, url }, today));
  }

  const created: JobRecord[] = [];
  for (const row of toCreate) {
    const res = await supabaseFetch(env, "/jobs", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (res.status === 409) {
      skipped.push({
        url: String(row.job_url),
        reason: "duplicate (database constraint)",
      });
      continue;
    }
    const body = (await expectOk(res)) as DbJobRow[];
    if (body[0]) created.push(rowToJob(body[0]));
  }

  return { created, skipped, existing_count: existing.length };
}

export async function updateJob(
  env: Env,
  lookup: { record_id?: string; url?: string },
  patch: JobPatch,
  today: string,
) {
  let id = lookup.record_id?.trim();
  if (!id && lookup.url) {
    const url = normalizeJobUrl(lookup.url);
    const params = new URLSearchParams({
      select: JOB_COLUMNS,
      job_url: `eq.${url}`,
      limit: "1",
    });
    const res = await supabaseFetch(env, `/jobs?${params.toString()}`);
    const rows = (await expectOk(res)) as DbJobRow[];
    if (!rows.length) throw new Error(`No job found for url ${url}`);
    id = rows[0].id;
  }
  if (!id) throw new Error("Provide record_id or url");

  const row: Record<string, unknown> = { last_updated: today };
  if (patch.status) {
    row.status = patch.status;
    row.status_date = today;
    if (patch.status === "applied" && !patch.applied_date) {
      row.applied_date = today;
    }
  }
  if (patch.notes != null) row.notes = patch.notes;
  if (patch.applied_date) row.applied_date = patch.applied_date;
  if (patch.outreach_message != null) row.outreach_message = patch.outreach_message;
  if (patch.visa_sponsorship) row.visa_sponsorship = patch.visa_sponsorship;
  if (patch.visa_notes != null) row.visa_notes = patch.visa_notes;
  if (patch.follow_up_date) row.follow_up_date = patch.follow_up_date;
  if (patch.salary) row.salary = patch.salary;
  if (patch.work_mode) row.work_mode = patch.work_mode;

  const params = new URLSearchParams({ id: `eq.${id}` });
  const res = await supabaseFetch(env, `/jobs?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  const body = (await expectOk(res)) as DbJobRow[];
  if (!body[0]) throw new Error(`Update failed for id ${id}`);
  return rowToJob(body[0]);
}

export async function logSearchRun(
  env: Env,
  input: {
    query: string;
    region?: string;
    results_count: number;
    new_jobs_added: number;
    skipped_duplicates?: number;
    date?: string;
  },
  today: string,
) {
  const row = {
    query: input.query,
    region: input.region ?? null,
    results_count: input.results_count,
    new_jobs_added: input.new_jobs_added,
    skipped_duplicates: input.skipped_duplicates ?? 0,
    run_date: input.date || today,
  };
  const res = await supabaseFetch(env, "/search_runs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  const body = (await expectOk(res)) as { id: string }[];
  return { record_id: body[0]?.id, ...input, date: input.date || today };
}

export function pipelineCounts(jobs: JobRecord[]) {
  const by_status: Record<string, number> = {};
  const by_region: Record<string, number> = {};
  for (const job of jobs) {
    const s = job.status || "unknown";
    const r = job.region || "unknown";
    by_status[s] = (by_status[s] || 0) + 1;
    by_region[r] = (by_region[r] || 0) + 1;
  }
  return { total: jobs.length, by_status, by_region };
}
