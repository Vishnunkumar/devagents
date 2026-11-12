import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Job, TrackerUser } from "./types";

export const SELECTED_USER_STORAGE_KEY = "job-tracker-selected-user-id";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.PUBLIC_SUPABASE_URL ||
    "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function fetchUsers(): Promise<TrackerUser[]> {
  const { data, error } = await getSupabase()
    .from("users")
    .select("user_id, name, role")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TrackerUser[];
}

export async function fetchJobs(userId: string): Promise<Job[]> {
  const { data, error } = await getSupabase()
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("discovered_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Job[];
}

export async function updateJob(id: string, patch: Record<string, unknown>): Promise<Job> {
  const today = new Date().toISOString().slice(0, 10);
  const payload: Record<string, unknown> = {
    ...patch,
    last_updated: today,
  };

  if (typeof patch.status === "string") {
    payload.status_date = today;
    if (patch.status === "applied" && !patch.applied_date) {
      payload.applied_date = today;
    }
  }

  const { data, error } = await getSupabase()
    .from("jobs")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Job;
}

export async function deleteJob(id: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from("jobs")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Job was not deleted. Check your Supabase permissions.");
}
