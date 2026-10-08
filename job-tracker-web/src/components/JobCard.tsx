"use client";

import type { Job } from "@/lib/types";
import { REGION_LABELS } from "@/lib/types";

export function JobCard({
  job,
  onSelect,
}: {
  job: Job;
  onSelect: (job: Job) => void;
}) {
  const visaHot = job.visa_sponsorship === "yes" || job.visa_sponsorship === "likely";

  return (
    <button
      type="button"
      onClick={() => onSelect(job)}
      className="w-full rounded-xl border border-line bg-bg-elevated p-3 text-left shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-snug text-ink">
            {job.title}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink-muted">{job.company}</p>
        </div>
        {visaHot ? (
          <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            visa {job.visa_sponsorship}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-muted">
        {(job.location || job.country) && (
          <span>{[job.location, job.country].filter(Boolean).join(", ")}</span>
        )}
        {job.region ? <span>· {REGION_LABELS[job.region]}</span> : null}
        {job.work_mode && job.work_mode !== "unknown" ? (
          <span>· {job.work_mode}</span>
        ) : null}
      </div>

      {job.salary ? (
        <p className="mt-2 text-xs font-medium text-ink">{job.salary}</p>
      ) : null}
    </button>
  );
}
