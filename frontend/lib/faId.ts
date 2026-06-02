"use client";

/**
 * Anonymous per-device identity. No login — progress simply follows the
 * browser via a stable id kept in localStorage and sent as the X-FA-Id header.
 */
const KEY = "bima.fa_id";

export function getFaId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `fa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Headers helper — spreads the FA id header when available. */
export function faHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const id = getFaId();
  return id ? { ...extra, "X-FA-Id": id } : extra;
}
