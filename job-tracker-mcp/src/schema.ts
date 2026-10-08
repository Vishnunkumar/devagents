import type { JobRecord } from "./types";

/** PostgREST / `public.jobs` columns */
export interface DbJobRow {
  id: string;
  job_url: string;
  title: string;
  company: string;
  location: string;
  country: string;
  region: string | null;
  source: string;
  visa_sponsorship: string;
  visa_notes: string;
  salary: string;
  work_mode: string;
  description_snippet: string;
  status: string;
  discovered_date: string;
  status_date: string;
  applied_date: string | null;
  notes: string;
  outreach_message: string;
  follow_up_date: string | null;
  last_updated: string;
}

export function rowToJob(row: DbJobRow): JobRecord {
  return {
    record_id: row.id,
    url: row.job_url ?? "",
    title: row.title ?? "",
    company: row.company ?? "",
    location: row.location ?? "",
    country: row.country ?? "",
    region: row.region ?? "",
    source: row.source ?? "",
    visa_sponsorship: row.visa_sponsorship ?? "",
    visa_notes: row.visa_notes ?? "",
    salary: row.salary ?? "",
    work_mode: row.work_mode ?? "",
    description_snippet: row.description_snippet ?? "",
    status: row.status ?? "",
    discovered_date: row.discovered_date ?? "",
    status_date: row.status_date ?? "",
    applied_date: row.applied_date ?? "",
    notes: row.notes ?? "",
    outreach_message: row.outreach_message ?? "",
    follow_up_date: row.follow_up_date ?? "",
    last_updated: row.last_updated ?? "",
  };
}

export function toCompact(job: JobRecord) {
  return {
    record_id: job.record_id,
    url: job.url,
    title: job.title,
    company: job.company,
    location: job.location,
    country: job.country,
    region: job.region,
    visa_sponsorship: job.visa_sponsorship,
    work_mode: job.work_mode,
    status: job.status,
    discovered_date: job.discovered_date,
    applied_date: job.applied_date,
    salary: job.salary,
    source: job.source,
  };
}
