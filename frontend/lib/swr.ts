"use client";

import { authedFetch } from "./api";

/**
 * Lightweight stale-while-revalidate cache backed by sessionStorage.
 *
 * The backend lives on Hugging Face Spaces, whose free tier sleeps after idle
 * and pays a cold-start cost (tens of seconds) on the next request. Without a
 * cache, every tab switch re-fetches and blocks behind that cold start. With
 * SWR, a revisited page paints instantly from cache, then refreshes in the
 * background — the slow request happens off the critical path.
 *
 * Cache lives for the tab session only (sessionStorage), so a fresh load always
 * gets server-truth and we never serve stale data across sign-ins.
 */

const PREFIX = "bima.cache.";

export function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // sessionStorage full or unavailable — caching is best-effort.
  }
}

export function clearCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * Fire a single cheap request per tab session to wake the backend container
 * before the user navigates to a data-heavy page. Uses the public personas
 * endpoint (static data, no auth, no Firestore) purely to defeat the cold
 * start. Safe to call on every page mount — it self-dedupes.
 */
let warmedThisSession = false;

export function warmBackend(): void {
  if (typeof window === "undefined" || warmedThisSession) return;
  warmedThisSession = true;
  try {
    if (sessionStorage.getItem("bima.warmed") === "1") return;
    sessionStorage.setItem("bima.warmed", "1");
  } catch {
    // sessionStorage unavailable — still worth one warm-up this page load.
  }
  // Fire and forget; failures are irrelevant (we only want to wake the box).
  authedFetch("/api/training/personas").catch(() => {});
}
