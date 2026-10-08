export interface Env {
  SUPABASE_URL?: string;
  PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

export const REGIONS = ["europe", "oceania", "asia", "me", "other"] as const;
export const STATUSES = [
  "discovered",
  "interested",
  "applied",
  "interviewing",
  "selected",
  "rejected",
  "offer",
  "withdrawn",
] as const;
export const VISA = ["yes", "no", "unknown", "likely"] as const;
export const WORK_MODES = ["onsite", "hybrid", "remote", "unknown"] as const;

export type Region = (typeof REGIONS)[number];
export type Status = (typeof STATUSES)[number];
export type VisaSponsorship = (typeof VISA)[number];
export type WorkMode = (typeof WORK_MODES)[number];

export interface JobRecord {
  record_id: string;
  url: string;
  title: string;
  company: string;
  location: string;
  country: string;
  region: string;
  source: string;
  visa_sponsorship: string;
  visa_notes: string;
  salary: string;
  work_mode: string;
  description_snippet: string;
  status: string;
  discovered_date: string;
  status_date: string;
  applied_date: string;
  notes: string;
  outreach_message: string;
  follow_up_date: string;
  last_updated: string;
}

export interface NewJob {
  url: string;
  title: string;
  company: string;
  location?: string;
  country?: string;
  region?: Region;
  source?: string;
  visa_sponsorship?: VisaSponsorship;
  visa_notes?: string;
  salary?: string;
  work_mode?: WorkMode;
  description_snippet?: string;
}

export interface JobPatch {
  status?: Status;
  notes?: string;
  applied_date?: string;
  outreach_message?: string;
  visa_sponsorship?: VisaSponsorship;
  visa_notes?: string;
  follow_up_date?: string;
  salary?: string;
  work_mode?: WorkMode;
}

export type CompactJob = Pick<
  JobRecord,
  | "record_id"
  | "url"
  | "title"
  | "company"
  | "location"
  | "country"
  | "region"
  | "visa_sponsorship"
  | "work_mode"
  | "status"
  | "discovered_date"
  | "applied_date"
  | "salary"
  | "source"
>;
