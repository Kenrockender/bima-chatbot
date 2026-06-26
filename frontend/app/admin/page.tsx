"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { BimaAvatar } from "@/components/BimaAvatar";
import { AppShell } from "@/components/AppShell";
import { useConfirm } from "@/components/ConfirmModal";
import { FetchError } from "@/components/FetchError";
import { authedFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

type Source = {
  id: string;
  name: string;
  type: "pdf" | "url";
  origin: string;
  status: "processing" | "ready" | "failed";
  error: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
};

type Toast = { id: number; kind: "ok" | "err"; text: string };

export default function AdminPage() {
  const [confirmModal, askConfirm] = useConfirm();
  const { user, signOut } = useAuth();
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sources, setSources] = useState<Source[]>([]);
  const [url, setUrl] = useState("");
  const [urlName, setUrlName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  // Verify admin rights via the bearer token. Re-runs when the signed-in user
  // changes (e.g. after the auth state resolves on first load).
  const [fetchError, setFetchError] = useState(false);

  function loadAuth() {
    setChecking(true);
    setFetchError(false);
    let alive = true;
    authedFetch("/api/admin/verify", { method: "POST" })
      .then((res) => alive && setAuthed(res.ok))
      .catch(() => { if (alive) { setAuthed(false); setFetchError(true); } })
      .finally(() => alive && setChecking(false));
    return () => { alive = false; };
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const cleanup = loadAuth(); return cleanup; }, [user]);

  function toast(kind: "ok" | "err", text: string) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  const loadSources = useCallback(async () => {
    const res = await authedFetch("/api/admin/sources");
    if (res.ok) setSources(await res.json());
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadSources();
    const i = setInterval(loadSources, 4000);
    return () => clearInterval(i);
  }, [authed, loadSources]);

  async function uploadFiles(files: FileList | File[]) {
    const docs = Array.from(files).filter(
      (f) =>
        f.name.toLowerCase().endsWith(".pdf") ||
        f.name.toLowerCase().endsWith(".pptx"),
    );
    if (docs.length === 0) {
      toast("err", "Only PDF or PPTX files are accepted");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    docs.forEach((f) => fd.append("files", f));
    try {
      const res = await authedFetch("/api/admin/sources/pdf", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      toast("ok", `Uploaded ${docs.length} file(s) — processing…`);
      loadSources();
    } catch {
      toast("err", "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function addUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    try {
      const res = await authedFetch("/api/admin/sources/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name: urlName || undefined }),
      });
      if (!res.ok) throw new Error();
      toast("ok", "URL added — processing…");
      setUrl("");
      setUrlName("");
      loadSources();
    } catch {
      toast("err", "Failed to add URL");
    }
  }

  async function deleteSource(id: string) {
    const ok = await askConfirm("Delete this source from the knowledge base?", {
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const res = await authedFetch(`/api/admin/sources/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast("ok", "Source deleted");
      loadSources();
    } else {
      toast("err", "Delete failed");
    }
  }

  async function reindex(id: string) {
    const res = await authedFetch(`/api/admin/sources/${id}/reindex`, {
      method: "POST",
    });
    if (res.ok) {
      toast("ok", "Re-indexing started");
      loadSources();
    } else {
      toast("err", "Re-index failed");
    }
  }

  // ─────────────────────────── ACCESS GATE ───────────────────────────
  if (checking) {
    return (
      <main className="min-h-screen bg-life px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-5 animate-fadeIn">
          <div className="skeleton h-8 w-32 mb-4" />
          <div className="life-card p-6 space-y-3">
            <div className="skeleton h-3 w-40" />
            {[1,2,3].map(i => <div key={i} className="flex items-center gap-3"><div className="skeleton h-10 w-10 rounded-lg" /><div className="skeleton h-4 flex-1" /><div className="skeleton h-8 w-16 rounded-full" /></div>)}
          </div>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-life relative overflow-hidden px-4">
        {fetchError ? (
          <FetchError message="Failed to load. Please try again." onRetry={loadAuth} />
        ) : (
        <div className="relative z-10 w-full max-w-md life-card p-8 animate-riseIn text-center overflow-hidden">
          <span
            aria-hidden
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: "linear-gradient(90deg, #0a55ab, #19b8a6)" }}
          />
          <div className="flex items-center justify-center gap-3.5 mb-3">
            <BimaAvatar size={44} />
            <span className="life-eyebrow">Console</span>
          </div>
          <h1 className="font-sans font-extrabold text-life-heading text-[22px]">
            Akses ditolak
          </h1>
          <p className="text-[13px] text-life-body mt-2">
            {user
              ? `Akun ${user.email ?? ""} tidak punya akses admin.`
              : "Kamu perlu masuk dengan akun admin."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="text-[12px] smallcaps text-life-body hover:text-life-blue transition"
            >
              ← Kembali ke chat
            </Link>
            {user && (
              <button
                onClick={() => signOut()}
                className="text-[12px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-full px-3 py-1.5 transition"
              >
                Ganti akun
              </button>
            )}
          </div>
        </div>
        )}
      </main>
    );
  }

  // ─────────────────────────── DASHBOARD ───────────────────────────
  return (
    <AppShell lang="en" current="admin">
      {confirmModal}

      {/* Hero band */}
      <section className="life-gradient relative overflow-hidden">
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 460, height: 460, right: -140, top: -180,
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.16), rgba(255,255,255,0))",
          }}
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-9 pb-14 animate-riseIn">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-white/90" />
            <span className="h-1 w-10 rounded-full bg-white/70" />
            <span className="ml-1 text-[11.5px] font-bold uppercase tracking-[0.13em] text-white/85">
              Knowledge base
            </span>
          </div>
          <h2
            className="font-sans font-extrabold text-white text-[32px] sm:text-[42px] leading-[1.08] tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            Curate what BIMA knows.
          </h2>
          <p className="mt-2.5 text-[14.5px] leading-[1.6] text-white/80 max-w-[620px]">
            Upload approved BCA Life documents or link to internal pages. BIMA
            answers staff questions strictly from this collection — nothing
            else.
          </p>
        </div>
      </section>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-9 -mt-7 space-y-10">

        {/* Upload + URL */}
        <section className="grid md:grid-cols-2 gap-5 animate-riseIn" style={{ animationDelay: "120ms" }}>
          {/* PDF dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              uploadFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInput.current?.click()}
            className={`relative life-card p-7 cursor-pointer transition-all overflow-hidden ${
              drag ? "ring-4 ring-life-blue/20" : "hover:shadow-lifeHover"
            }`}
            style={{
              borderStyle: drag ? "solid" : "dashed",
              borderWidth: "1.5px",
              borderColor: drag ? "#0a55ab" : "#cdd9e6",
            }}
          >
            <span
              aria-hidden
              className="absolute top-0 left-0 h-1 w-12"
              style={{ background: "linear-gradient(90deg, #0a55ab, #19b8a6)" }}
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="life-eyebrow">PDF / PPTX upload</span>
              <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
            </div>
            <div className="flex items-start gap-4">
              <div className="life-icon shrink-0" style={{ width: 48, height: 48 }}>
                <span className="text-white text-2xl font-bold">↑</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans font-bold text-life-heading text-[17px] leading-snug">
                  {uploading
                    ? "Uploading…"
                    : "Drop PDF or PPTX files here, or click to browse."}
                </p>
                <p className="text-[12.5px] text-life-body mt-1">
                  Multiple files supported · processed in the background
                </p>
              </div>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.pptx"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
          </div>

          {/* URL form */}
          <form
            onSubmit={addUrl}
            className="relative life-card p-7 overflow-hidden"
          >
            <span
              aria-hidden
              className="absolute top-0 left-0 h-1 w-12"
              style={{ background: "#0a55ab" }}
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="life-eyebrow">Add URL</span>
              <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
            </div>
            <p className="font-sans font-bold text-life-heading text-[17px] leading-snug mb-4">
              Index a public or internal page.
            </p>
            <div className="space-y-2.5">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.bcalife.co.id/produk/…"
                className="w-full rounded-[12px] border border-life-blue/15 bg-white px-4 py-2.5 text-[14px] focus-yellow transition placeholder:text-life-bodyLight"
              />
              <input
                type="text"
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                placeholder="Display name (optional)"
                className="w-full rounded-[12px] border border-life-blue/15 bg-white px-4 py-2.5 text-[14px] focus-yellow transition placeholder:text-life-bodyLight"
              />
              <button
                type="submit"
                className="w-full btn-life justify-center"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-life-amber" />
                Add to knowledge base
              </button>
            </div>
          </form>
        </section>

        {/* Sources */}
        <section
          className="relative life-card overflow-hidden animate-riseIn"
          style={{ animationDelay: "220ms" }}
        >
          <span
            aria-hidden
            className="absolute top-0 left-0 h-1 w-16"
            style={{ background: "linear-gradient(90deg, #0a55ab, #19b8a6)" }}
          />
          <div className="px-7 pt-6 pb-4 flex items-end justify-between gap-3 border-b border-life-blue/12">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="life-eyebrow">Library</span>
                <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
              </div>
              <h3 className="font-sans font-extrabold text-life-heading text-[22px] leading-snug">
                Sources
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-life-heading/80 px-3 py-1.5 rounded-full bg-life-blueBg border border-life-blue/12">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: "#0a55ab" }}
              />
              <span className="font-semibold">{sources.length}</span>
              <span className="text-life-body">
                {sources.length === 1 ? "source" : "sources"}
              </span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left">
                  {["Name", "Type", "Status", "Chunks", "Added", ""].map(
                    (h, i) => (
                      <th
                        key={i}
                        className="px-7 py-3.5 smallcaps text-life-body font-semibold bg-life-blueBg/50"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-7 py-14 text-center text-life-body"
                    >
                      <p className="font-sans font-bold text-life-heading/70 text-[18px] mb-1">
                        Nothing here yet.
                      </p>
                      <p className="text-[13px]">
                        Upload a PDF/PPTX or add a URL above to start the library.
                      </p>
                    </td>
                  </tr>
                )}
                {sources.map((s, i) => (
                  <tr
                    key={s.id}
                    className="border-t border-life-blue/[0.08] hover:bg-life-blueBg/40 transition"
                  >
                    <td className="px-7 py-4 align-top">
                      <div className="font-medium text-life-heading leading-snug break-all max-w-[420px]">
                        {s.name}
                      </div>
                    </td>
                    <td className="px-7 py-4 align-top">
                      <span className="smallcaps text-life-body">{s.type}</span>
                    </td>
                    <td className="px-7 py-4 align-top">
                      <StatusBadge status={s.status} error={s.error} />
                    </td>
                    <td className="px-7 py-4 align-top text-life-heading/80 tabular-nums">
                      {s.chunk_count}
                    </td>
                    <td className="px-7 py-4 align-top text-life-body text-[12px] tabular-nums whitespace-nowrap">
                      {s.created_at}
                    </td>
                    <td className="px-7 py-4 align-top text-right whitespace-nowrap">
                      <button
                        onClick={() => reindex(s.id)}
                        className="text-[12px] px-3 py-1.5 rounded-full border border-life-blue/15 bg-white hover:border-life-blue hover:text-life-blue transition mr-1.5"
                      >
                        Re-index
                      </button>
                      <button
                        onClick={() => deleteSource(s.id)}
                        className="text-[12px] px-3 py-1.5 rounded-full border border-red-200 text-red-700 hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-5 right-5 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="life-card px-4 py-3 flex items-center gap-2.5 animate-riseIn min-w-[240px]"
          >
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{
                background: t.kind === "ok" ? "#1f9d57" : "#c0392b",
              }}
            />
            <span className="text-[13px] text-life-heading/85">{t.text}</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: string;
  error: string | null;
}) {
  const map: Record<string, { bg: string; fg: string; border: string; dot: string }> = {
    ready: {
      bg: "rgba(31, 157, 87, 0.10)",
      fg: "#1f9d57",
      border: "rgba(31, 157, 87, 0.28)",
      dot: "#1f9d57",
    },
    processing: {
      bg: "rgba(249, 178, 51, 0.14)",
      fg: "#7a4f00",
      border: "rgba(249, 178, 51, 0.35)",
      dot: "#F9B233",
    },
    failed: {
      bg: "rgba(192, 57, 43, 0.10)",
      fg: "#c0392b",
      border: "rgba(192, 57, 43, 0.28)",
      dot: "#c0392b",
    },
  };
  const c = map[status] || map.processing;
  return (
    <span
      title={error || ""}
      className="inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-full font-medium"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{
          background: c.dot,
          animation: status === "processing" ? "blink 1.4s ease-in-out infinite" : undefined,
        }}
      />
      {status}
    </span>
  );
}
