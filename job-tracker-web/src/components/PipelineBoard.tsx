"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  deleteJob,
  fetchJobs,
  fetchUsers,
  updateJob,
} from "@/lib/supabase";
import {
  pickInitialUserId,
  readStoredUserId,
  writeStoredUserId,
} from "@/lib/selectedUser";
import type { Job, Region, Status, TrackerUser, VisaSponsorship } from "@/lib/types";
import {
  REGION_LABELS,
  REGIONS,
  STATUSES,
  STATUS_LABELS,
} from "@/lib/types";

import { JobCard } from "./JobCard";
import { JobDrawer } from "./JobDrawer";

const ACTIVE_COLUMNS: Status[] = [
  "discovered",
  "interested",
  "applied",
  "interviewing",
  "offer",
];

export function PipelineBoard() {
  const [users, setUsers] = useState<TrackerUser[]>([]);
  const [userId, setUserId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [region, setRegion] = useState<Region | "all">("all");
  const [visaFilter, setVisaFilter] = useState<VisaSponsorship | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Job | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const activeUser = useMemo(
    () => users.find((u) => u.user_id === userId) ?? null,
    [users, userId],
  );

  const loadUsers = useCallback(async () => {
    const rows = await fetchUsers();
    setUsers(rows);
    const initial = pickInitialUserId(rows, readStoredUserId());
    if (initial) {
      writeStoredUserId(initial);
      setUserId(initial);
    } else {
      setLoading(false);
    }
  }, []);

  const loadJobs = useCallback(async (profileId: string) => {
    if (!profileId) return;
    setLoading(true);
    setError("");
    try {
      setJobs(await fetchJobs(profileId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setError("");
      try {
        await loadUsers();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();
  }, [loadUsers]);

  useEffect(() => {
    if (!userId) return;
    void loadJobs(userId);
  }, [userId, loadJobs]);

  function handleProfileChange(nextId: string) {
    if (nextId === userId) return;
    writeStoredUserId(nextId);
    setUserId(nextId);
    setSelected(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs
      .filter((j) => {
        if (region !== "all" && j.region !== region) return false;
        if (visaFilter !== "all" && j.visa_sponsorship !== visaFilter) return false;
        if (dateFrom && j.discovered_date < dateFrom) return false;
        if (dateTo && j.discovered_date > dateTo) return false;
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q) ||
          j.country.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const comparison = (a.discovered_date || "").localeCompare(b.discovered_date || "");
        return dateSort === "newest" ? -comparison : comparison;
      });
  }, [jobs, region, visaFilter, dateFrom, dateTo, dateSort, query]);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const s of STATUSES) byStatus[s] = 0;
    for (const j of filtered) byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    return byStatus;
  }, [filtered]);

  const columns = showClosed ? STATUSES : ACTIVE_COLUMNS;

  async function handleSave(id: string, patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const updated = await updateJob(id, patch);
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
      setSelected(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    setError("");
    try {
      await deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line/80 bg-bg-elevated/80 px-4 py-5 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Relocate
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-ink md:text-4xl">
              Job Tracker
            </h1>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">
              {activeUser
                ? `Pipeline for ${activeUser.name}. Update status as you apply.`
                : "Pipeline from Cursor search → Supabase."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent">
              {filtered.length} shown
            </span>
            <span className="rounded-full bg-bg px-3 py-1 text-ink-muted">
              {jobs.length} total
            </span>
            <button
              type="button"
              onClick={() => userId && void loadJobs(userId)}
              disabled={!userId}
              className="rounded-full border border-line bg-bg-elevated px-3 py-1 font-medium text-ink hover:border-accent disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mx-auto mt-5 flex max-w-[1600px] flex-wrap gap-2">
          <select
            value={userId}
            onChange={(e) => handleProfileChange(e.target.value)}
            disabled={users.length === 0}
            className="min-w-[200px] rounded-lg border border-line bg-bg px-3 py-2 text-sm font-medium"
            aria-label="Profile"
          >
            {users.length === 0 ? (
              <option value="">No profiles</option>
            ) : (
              users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name}
                </option>
              ))
            )}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, company, location…"
            className="min-w-[220px] flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as Region | "all")}
            className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            aria-label="Filter by region"
          >
            <option value="all">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {REGION_LABELS[r]}
              </option>
            ))}
          </select>
          <select
            value={visaFilter}
            onChange={(e) => setVisaFilter(e.target.value as VisaSponsorship | "all")}
            className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            aria-label="Filter by visa sponsorship"
          >
            <option value="all">All visa statuses</option>
            <option value="yes">Visa yes</option>
            <option value="likely">Visa likely</option>
            <option value="no">No visa sponsorship</option>
            <option value="unknown">Visa unknown</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
            <span className="text-ink-muted">Discovered from</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="min-w-0 bg-transparent"
              aria-label="Discovered date from"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
            <span className="text-ink-muted">to</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="min-w-0 bg-transparent"
              aria-label="Discovered date to"
            />
          </label>
          <select
            value={dateSort}
            onChange={(e) => setDateSort(e.target.value as "newest" | "oldest")}
            className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            aria-label="Sort by discovered date"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
            />
            Show closed
          </label>
          {(dateFrom || dateTo || visaFilter !== "all" || region !== "all") && (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setVisaFilter("all");
                setRegion("all");
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
            >
              Clear filters
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-x-auto px-4 py-5 md:px-8">
        {error ? (
          <div className="mx-auto max-w-xl rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
            <p className="font-semibold">Could not complete the request</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-ink-muted">
              Check env vars and that RLS policies are applied in Supabase.
            </p>
          </div>
        ) : null}

        {loading && !error ? (
          <p className="text-sm text-ink-muted">Loading pipeline…</p>
        ) : null}

        {!loading && !error ? (
          <div className="inline-flex min-w-full gap-3 pb-4">
            {columns.map((status) => {
              const colJobs = filtered.filter((j) => j.status === status);
              return (
                <section
                  key={status}
                  className="flex w-[280px] shrink-0 flex-col rounded-2xl border border-line/70 bg-bg/60"
                >
                  <div className="flex items-center justify-between border-b border-line/70 px-3 py-2.5">
                    <h2 className="text-sm font-semibold text-ink">
                      {STATUS_LABELS[status]}
                    </h2>
                    <span className="rounded-md bg-bg-elevated px-1.5 py-0.5 text-xs font-medium text-ink-muted">
                      {counts[status] || 0}
                    </span>
                  </div>
                  <div className="flex max-h-[calc(100vh-320px)] flex-col gap-2 overflow-y-auto p-2">
                    {colJobs.length === 0 ? (
                      <p className="px-1 py-3 text-center text-xs text-ink-muted">
                        Empty
                      </p>
                    ) : (
                      colJobs.map((job) => (
                        <JobCard key={job.id} job={job} onSelect={setSelected} />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </main>

      <JobDrawer
        job={selected}
        saving={saving}
        deleting={deleting}
        onClose={() => setSelected(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
