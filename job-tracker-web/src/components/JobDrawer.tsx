"use client";

import { useEffect, useState } from "react";

import type { Job, Status, VisaSponsorship, WorkMode } from "@/lib/types";
import { REGION_LABELS, STATUSES, STATUS_LABELS, VISA, WORK_MODES } from "@/lib/types";

export function JobDrawer({
  job,
  saving,
  onClose,
  onSave,
}: {
  job: Job | null;
  saving: boolean;
  onClose: () => void;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [status, setStatus] = useState<Status>("discovered");
  const [notes, setNotes] = useState("");
  const [visa, setVisa] = useState<VisaSponsorship>("unknown");
  const [visaNotes, setVisaNotes] = useState("");
  const [workMode, setWorkMode] = useState<WorkMode>("unknown");
  const [salary, setSalary] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!job) return;
    setStatus(job.status);
    setNotes(job.notes ?? "");
    setVisa(job.visa_sponsorship);
    setVisaNotes(job.visa_notes ?? "");
    setWorkMode(job.work_mode);
    setSalary(job.salary ?? "");
    setFollowUp(job.follow_up_date ?? "");
    setError("");
  }, [job]);

  if (!job) return null;

  async function handleSave() {
    setError("");
    try {
      await onSave(job!.id, {
        status,
        notes,
        visa_sponsorship: visa,
        visa_notes: visaNotes,
        work_mode: workMode,
        salary,
        follow_up_date: followUp || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/25 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-line bg-bg-elevated shadow-[var(--shadow)]">
        <header className="border-b border-line px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Job detail
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight text-ink">
            {job.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {job.company}
            {job.region ? ` · ${REGION_LABELS[job.region]}` : ""}
          </p>
          <a
            href={job.job_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            Open listing →
          </a>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="w-full rounded-[0.6rem] border border-line bg-bg px-3 py-2 text-ink"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Visa sponsorship">
            <select
              value={visa}
              onChange={(e) => setVisa(e.target.value as VisaSponsorship)}
              className="w-full rounded-[0.6rem] border border-line bg-bg px-3 py-2 text-ink"
            >
              {VISA.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Work mode">
            <select
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value as WorkMode)}
              className="w-full rounded-[0.6rem] border border-line bg-bg px-3 py-2 text-ink"
            >
              {WORK_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Salary">
            <input
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full rounded-[0.6rem] border border-line bg-bg px-3 py-2 text-ink"
              placeholder="e.g. €70–85k"
            />
          </Field>

          <Field label="Follow-up date">
            <input
              type="date"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              className="w-full rounded-[0.6rem] border border-line bg-bg px-3 py-2 text-ink"
            />
          </Field>

          <Field label="Visa notes">
            <textarea
              value={visaNotes}
              onChange={(e) => setVisaNotes(e.target.value)}
              rows={2}
              className="w-full resize-y rounded-[0.6rem] border border-line bg-bg px-3 py-2 text-ink"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-[0.6rem] border border-line bg-bg px-3 py-2 text-ink"
              placeholder="Interview notes, contacts, next steps…"
            />
          </Field>

          {job.description_snippet ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Snippet
              </p>
              <p className="rounded-lg bg-bg px-3 py-2 text-sm leading-relaxed text-ink-muted">
                {job.description_snippet}
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}
        </div>

        <footer className="flex gap-2 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
