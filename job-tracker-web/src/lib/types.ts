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

export const REGIONS = ["europe", "oceania", "asia", "me", "other"] as const;
export const VISA = ["yes", "no", "unknown", "likely"] as const;
export const WORK_MODES = ["onsite", "hybrid", "remote", "unknown"] as const;

export type Status = (typeof STATUSES)[number];
export type Region = (typeof REGIONS)[number];
export type VisaSponsorship = (typeof VISA)[number];
export type WorkMode = (typeof WORK_MODES)[number];

export interface Job {
  id: string;
  job_url: string;
  title: string;
  company: string;
  location: string;
  country: string;
  region: Region | null;
  source: string;
  visa_sponsorship: VisaSponsorship;
  visa_notes: string;
  salary: string;
  work_mode: WorkMode;
  description_snippet: string;
  status: Status;
  discovered_date: string;
  status_date: string;
  applied_date: string | null;
  notes: string;
  outreach_message: string;
  follow_up_date: string | null;
  last_updated: string;
  created_at: string;
}

export type JobPatch = Partial<
  Pick<
    Job,
    | "status"
    | "notes"
    | "applied_date"
    | "visa_sponsorship"
    | "visa_notes"
    | "follow_up_date"
    | "salary"
    | "work_mode"
    | "outreach_message"
  >
>;

export const STATUS_LABELS: Record<Status, string> = {
  discovered: "Discovered",
  interested: "Interested",
  applied: "Applied",
  interviewing: "Interviewing",
  selected: "Selected",
  rejected: "Rejected",
  offer: "Offer",
  withdrawn: "Withdrawn",
};

export const REGION_LABELS: Record<Region, string> = {
  europe: "Europe",
  oceania: "Oceania",
  asia: "Asia",
  me: "Middle East",
  other: "Other",
};
