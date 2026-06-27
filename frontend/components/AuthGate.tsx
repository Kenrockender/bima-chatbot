"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

/**
 * Wraps the app. While Firebase auth is configured, unauthenticated users see
 * a Google sign-in screen and signed-in users see the app with an account chip.
 * If Firebase isn't configured (no env yet), the app renders with a small
 * notice so local development isn't blocked.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, enabled, signInWithGoogle } = useAuth();

  if (!enabled) {
    return (
      <>
        {children}
        <div className="fixed bottom-3 left-3 z-50 text-[11px] font-medium text-amber-900 bg-amber-100/90 border border-amber-300 rounded-full px-3 py-1 shadow">
          Auth belum dikonfigurasi
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <div className="bg-shell min-h-screen grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-life-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <SignIn onSignIn={signInWithGoogle} />;

  return (
    <>
      {children}
      <AccountChip />
    </>
  );
}

function SignIn({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await onSignIn();
    } catch (e: any) {
      const code = e?.code ?? "";
      if (code === "auth/popup-closed-by-user") setErr(null);
      else setErr("Gagal masuk. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-shell min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm life-card p-8 text-center relative overflow-hidden">
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: "linear-gradient(90deg, #0a55ab, #19b8a6)" }}
        />
        <div className="text-3xl font-sans font-extrabold text-life-heading tracking-tight">
          BIMA
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-life-body">
          Masuk untuk mulai latihan dan menyimpan progresmu.
        </p>
        <button
          onClick={go}
          disabled={busy}
          className="mt-6 w-full inline-flex items-center justify-center gap-3 rounded-full bg-white text-life-heading border border-life-blue/15 font-semibold text-[14px] px-4 py-3 shadow-life hover:shadow-lifeHover disabled:opacity-60 transition"
        >
          <GoogleMark />
          {busy ? "Membuka…" : "Masuk dengan Google"}
        </button>
        {err && <div className="mt-3 text-[12px] text-red-600">{err}</div>}
      </div>
    </div>
  );
}

// Global floating chip — desktop only. On mobile the same menu lives inline in
// the AppSidebar top bar (see AccountMenu) so it never covers the theme toggle.
function AccountChip() {
  return (
    <div className="hidden md:block fixed top-3 right-3 z-50">
      <AccountMenu />
    </div>
  );
}

/**
 * Avatar button + account dropdown. Position-agnostic: the dropdown is anchored
 * to this wrapper, so it can be dropped into a fixed corner (desktop) or inline
 * in the mobile top bar. `align` controls which edge the dropdown opens from.
 */
export function AccountMenu({ align = "right" }: { align?: "left" | "right" }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 w-9 rounded-full overflow-hidden border border-life-blue/20 shadow-float bg-life-blue grid place-items-center"
        title={user.displayName || user.email || ""}
        aria-label="Akun"
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-white text-[14px] font-bold">{initial}</span>
        )}
      </button>
      {open && (
        <div
          className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-2 w-56 rounded-bca bg-white shadow-cardHover border border-bca-line p-3 text-left z-50`}
        >
          <div className="text-[13px] font-semibold text-bca-ink truncate">
            {user.displayName || "—"}
          </div>
          <div className="text-[11.5px] text-bca-mute truncate">{user.email}</div>
          <button
            onClick={() => signOut()}
            className="mt-3 w-full text-[12.5px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-full px-3 py-1.5 transition"
          >
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" fill="#FBBC05" />
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
