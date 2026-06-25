"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { BimaAvatar } from "@/components/BimaAvatar";
import { AppNav } from "@/components/AppNav";
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
  useEffect(() => {
    let alive = true;
    setChecking(true);
    authedFetch("/api/admin/verify", { method: "POST" })
      .then((res) => alive && setAuthed(res.ok))
      .catch(() => alive && setAuthed(false))
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [user]);

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
    if (!confirm("Delete this source from the knowledge base?")) return;
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
      <main className="min-h-screen grid place-items-center bg-canvas">
        <div className="h-8 w-8 rounded-full border-2 border-bca-gold border-t-transparent animate-spin" />
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-canvas relative overflow-hidden px-4">
        <span className="watermark-b">B</span>
        <div className="relative z-10 w-full max-w-md surface-paper rounded-[18px] shadow-paper p-8 animate-riseIn text-center">
          <span
            aria-hidden
            className="absolute top-0 left-0 h-1 w-16 rounded-tl-[18px]"
            style={{ background: "#C8941E" }}
          />
          <div className="flex items-center justify-center gap-3.5 mb-3">
            <BimaAvatar size={44} />
            <span className="smallcaps text-bca-gold">Console</span>
          </div>
          <h1 className="font-serif text-bca-ink text-[22px]" style={{ fontWeight: 500 }}>
            Akses ditolak
          </h1>
          <p className="text-[13px] text-bca-mute mt-2">
            {user
              ? `Akun ${user.email ?? ""} tidak punya akses admin.`
              : "Kamu perlu masuk dengan akun admin."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="text-[12px] smallcaps text-bca-mute hover:text-bca-navy transition"
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
      </main>
    );
  }

  // ─────────────────────────── DASHBOARD ───────────────────────────
  return (
    <main className="min-h-screen bg-canvas relative overflow-hidden">
      <span className="watermark-b">B</span>

      {/* Header */}
      <header className="relative z-10 border-b border-bca-rule/70 bg-bca-cream/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-5 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <BimaAvatar size={40} />
              <div className="leading-tight">
                <div className="flex items-baseline gap-2">
                  <h1
                    className="font-serif text-bca-ink text-[22px]"
                    style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
                  >
                    BIMA
                  </h1>
                  <span className="smallcaps text-bca-gold">Console</span>
                </div>
                <p className="text-[12px] text-bca-mute mt-0.5 tracking-wide">
                  Knowledge base management
                </p>
              </div>
            </div>
            <AppNav lang="en" current="admin" />
          </div>
          <div className="gold-rule mt-4" />
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-10 space-y-10">
        {/* Eyebrow + Title */}
        <div className="animate-riseIn">
          <div className="flex items-center gap-3 mb-4">
            <span className="block w-7 h-px bg-bca-gold" />
            <span className="smallcaps text-bca-gold">
              Knowledge base
            </span>
          </div>
          <h2
            className="font-serif text-bca-ink text-[36px] sm:text-[44px] leading-[1.1] tracking-tight"
            style={{ fontWeight: 400, letterSpacing: "-0.025em" }}
          >
            Curate what BIMA knows.
          </h2>
          <p className="mt-3 text-[15px] text-bca-ink/70 max-w-2xl leading-relaxed">
            Upload approved BCA Life documents or link to internal pages. BIMA
            answers staff questions strictly from this collection — nothing
            else.
          </p>
        </div>

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
            className={`relative surface-paper rounded-[18px] p-7 cursor-pointer transition-all shadow-paper overflow-hidden ${
              drag ? "ring-4 ring-bca-gold/30 border-bca-gold" : "hover:border-bca-gold"
            }`}
            style={{
              borderStyle: drag ? "solid" : "dashed",
              borderWidth: "1.5px",
              borderColor: drag ? "#C8941E" : "#E6DFD0",
            }}
          >
            <span
              aria-hidden
              className="absolute top-0 left-0 h-1 w-12"
              style={{ background: "#C8941E" }}
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="smallcaps text-bca-gold">PDF / PPTX upload</span>
              <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
            </div>
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center rounded-[14px] shrink-0"
                style={{
                  width: 48,
                  height: 48,
                  background: "linear-gradient(150deg, #FDFBF6 0%, #F4ECDA 100%)",
                  border: "1px solid #E6DFD0",
                }}
              >
                <span
                  className="font-serif text-bca-navy text-2xl"
                  style={{ fontStyle: "italic" }}
                >
                  ↑
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-bca-ink text-[18px] leading-snug">
                  {uploading
                    ? "Uploading…"
                    : "Drop PDF or PPTX files here, or click to browse."}
                </p>
                <p className="text-[12.5px] text-bca-mute mt-1">
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
            className="relative surface-paper rounded-[18px] p-7 shadow-paper overflow-hidden"
          >
            <span
              aria-hidden
              className="absolute top-0 left-0 h-1 w-12"
              style={{ background: "#003D7A" }}
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="smallcaps text-bca-navy">Add URL</span>
              <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
            </div>
            <p className="font-serif text-bca-ink text-[18px] leading-snug mb-4">
              Index a public or internal page.
            </p>
            <div className="space-y-2.5">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.bcalife.co.id/produk/…"
                className="w-full rounded-[12px] border border-bca-rule bg-bca-paper px-4 py-2.5 text-[14px] focus-gold transition placeholder:text-bca-mute"
              />
              <input
                type="text"
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                placeholder="Display name (optional)"
                className="w-full rounded-[12px] border border-bca-rule bg-bca-paper px-4 py-2.5 text-[14px] focus-gold transition placeholder:text-bca-mute"
              />
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 bg-bca-navy hover:bg-bca-ink transition text-bca-cream text-[14px] font-medium rounded-full py-2.5 shadow-soft group"
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "#C8941E" }}
                />
                Add to knowledge base
              </button>
            </div>
          </form>
        </section>

        {/* Sources */}
        <section
          className="relative surface-paper rounded-[18px] shadow-paper overflow-hidden animate-riseIn"
          style={{ animationDelay: "220ms" }}
        >
          <span
            aria-hidden
            className="absolute top-0 left-0 h-1 w-16"
            style={{ background: "#C8941E" }}
          />
          <div className="px-7 pt-6 pb-4 flex items-end justify-between gap-3 border-b border-bca-rule">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="smallcaps text-bca-gold">Library</span>
                <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
              </div>
              <h3 className="font-serif text-bca-ink text-[22px] leading-snug">
                Sources
              </h3>
            </div>
            <span
              className="inline-flex items-center gap-1.5 text-[12.5px] text-bca-ink/80 px-3 py-1.5 rounded-full"
              style={{
                background: "linear-gradient(150deg, #FDFBF6 0%, #F4ECDA 100%)",
                border: "1px solid #E6DFD0",
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: "#003D7A" }}
              />
              <span className="font-semibold">{sources.length}</span>
              <span className="text-bca-mute">
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
                        className="px-7 py-3.5 smallcaps text-bca-mute font-semibold"
                        style={{ background: "rgba(247, 242, 232, 0.55)" }}
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
                      className="px-7 py-14 text-center text-bca-mute"
                    >
                      <p className="font-serif text-bca-ink/70 text-[18px] mb-1">
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
                    className="border-t border-bca-rule/60 hover:bg-bca-cream/40 transition"
                  >
                    <td className="px-7 py-4 align-top">
                      <div className="font-medium text-bca-ink leading-snug break-all max-w-[420px]">
                        {s.name}
                      </div>
                    </td>
                    <td className="px-7 py-4 align-top">
                      <span className="smallcaps text-bca-mute">{s.type}</span>
                    </td>
                    <td className="px-7 py-4 align-top">
                      <StatusBadge status={s.status} error={s.error} />
                    </td>
                    <td className="px-7 py-4 align-top text-bca-ink/80 tabular-nums">
                      {s.chunk_count}
                    </td>
                    <td className="px-7 py-4 align-top text-bca-mute text-[12px] tabular-nums whitespace-nowrap">
                      {s.created_at}
                    </td>
                    <td className="px-7 py-4 align-top text-right whitespace-nowrap">
                      <button
                        onClick={() => reindex(s.id)}
                        className="text-[12px] px-3 py-1.5 rounded-full border border-bca-rule bg-bca-paper hover:border-bca-gold hover:text-bca-navy transition mr-1.5"
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
            className="surface-paper rounded-[14px] shadow-paper px-4 py-3 flex items-center gap-2.5 animate-riseIn min-w-[240px]"
          >
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{
                background: t.kind === "ok" ? "#1E7B47" : "#B23A3A",
              }}
            />
            <span className="text-[13px] text-bca-ink/85">{t.text}</span>
          </div>
        ))}
      </div>
    </main>
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
      bg: "rgba(30, 123, 71, 0.08)",
      fg: "#1E7B47",
      border: "rgba(30, 123, 71, 0.25)",
      dot: "#1E7B47",
    },
    processing: {
      bg: "rgba(200, 148, 30, 0.10)",
      fg: "#8E6612",
      border: "rgba(200, 148, 30, 0.30)",
      dot: "#C8941E",
    },
    failed: {
      bg: "rgba(178, 58, 58, 0.08)",
      fg: "#B23A3A",
      border: "rgba(178, 58, 58, 0.25)",
      dot: "#B23A3A",
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
