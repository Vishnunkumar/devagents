import { SELECTED_USER_STORAGE_KEY } from "./supabase";
import type { TrackerUser } from "./types";

export function readStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(SELECTED_USER_STORAGE_KEY)?.trim();
  return value || null;
}

export function writeStoredUserId(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELECTED_USER_STORAGE_KEY, userId);
}

export function pickInitialUserId(
  users: TrackerUser[],
  stored: string | null,
): string {
  if (users.length === 0) return "";
  if (stored && users.some((u) => u.user_id === stored)) return stored;
  const fallback =
    users.find((u) => u.user_id === "vishnu-backend") ?? users[0];
  return fallback.user_id;
}
