"use client";

import { auth } from "./firebase";

/**
 * fetch() wrapper that attaches the signed-in user's Firebase ID token as a
 * bearer header. Public endpoints simply ignore it; protected ones (progress,
 * end-session, admin) require it. The Firebase SDK refreshes the token, so
 * getIdToken() always returns a currently-valid one.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const user = auth?.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // fall through unauthenticated; protected calls will 401 and the gate
      // will send the user back to sign-in.
    }
  }
  return fetch(input, { ...init, headers });
}
