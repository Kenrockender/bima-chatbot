import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Source = { name?: string; type?: string; page?: number | null; url?: string };

const mdComponents = {
  p: (props: any) => (
    <p className="mb-2 last:mb-0 leading-[1.6] text-[14.5px]" {...props} />
  ),
  strong: (props: any) => (
    <strong className="font-semibold" {...props} />
  ),
  ul: (props: any) => (
    <ul className="space-y-1.5 my-2 list-disc pl-5" {...props} />
  ),
  ol: (props: any) => (
    <ol className="list-decimal pl-5 space-y-1.5 my-2" {...props} />
  ),
  li: (props: any) => (
    <li className="leading-[1.6]" {...props} />
  ),
  h1: (props: any) => (
    <h3 className="font-bold text-lg mt-2 mb-1.5" {...props} />
  ),
  h2: (props: any) => (
    <h3 className="font-bold text-lg mt-2 mb-1.5" {...props} />
  ),
  h3: (props: any) => (
    <h3 className="font-semibold text-base mt-2 mb-1" {...props} />
  ),
  code: (props: any) => (
    <code
      className="px-1.5 py-0.5 rounded text-[12.5px] font-mono"
      style={{ background: "rgba(11,36,81,0.10)", color: "#0B2451" }}
      {...props}
    />
  ),
  a: (props: any) => (
    <a
      className="underline underline-offset-2 text-life-blue hover:text-life-teal transition"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  blockquote: (props: any) => (
    <blockquote
      className="border-l-[3px] pl-3 my-2 italic"
      style={{ borderColor: "#19b8a6" }}
      {...props}
    />
  ),
};

function fmtTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export function ChatBubble({
  role,
  content,
  sources,
  sourcesLabel,
  youLabel,
  bimaLabel,
  timestamp,
}: {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  sourcesLabel?: string;
  youLabel?: string;
  bimaLabel?: string;
  timestamp?: Date;
}) {
  const ts = timestamp ?? new Date();
  const stamp = fmtTime(ts);

  if (role === "user") {
    return (
      <div className="flex justify-end mb-4 animate-riseIn">
        <div className="max-w-[78%]">
          <div className="text-[10.5px] font-semibold text-bca-ink/55 text-right mb-1 pr-1 tracking-wide">
            [{(youLabel || "USER").toUpperCase()} — {stamp}]
          </div>
          <div className="bubble-user text-[14.5px]">
            <p className="whitespace-pre-wrap leading-[1.6]">{content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-4 animate-riseIn">
      <BimaBotAvatar />
      <div className="max-w-[78%] flex-1 min-w-0">
        <div className="text-[10.5px] font-semibold text-bca-ink/55 mb-1 pl-1 tracking-wide">
          [{(bimaLabel || "BIMA").toUpperCase()} — {stamp}]
        </div>
        <div className="bubble-bima">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {content}
          </ReactMarkdown>
        </div>
        {sources && sources.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
            <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-bca-ink/50">
              {sourcesLabel || "Source"}
            </span>
            {sources.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium bg-white/60 border border-bca-ink/10 rounded-full px-2 py-0.5"
                style={{ color: "#0B2451" }}
              >
                {s.name}
                {s.page ? ` · p.${s.page}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Friendly little robot/BIMA avatar used beside assistant bubbles
function BimaBotAvatar() {
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center"
      style={{
        width: 38,
        height: 38,
        background:
          "radial-gradient(120% 120% at 30% 25%, #2E68C6 0%, #0F3C86 55%, #061B45 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 10px -4px rgba(0,0,0,0.35)",
      }}
      aria-label="BIMA"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        {/* antenna */}
        <line x1="12" y1="2.5" x2="12" y2="5" stroke="#F5C518" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="2.4" r="1.2" fill="#F5C518" />
        {/* head */}
        <rect x="5" y="5.5" width="14" height="12" rx="4" fill="#EAF1FB" stroke="#F5C518" strokeWidth="0.8" />
        {/* eyes */}
        <circle cx="9.3" cy="11.3" r="1.4" fill="#0B2451" />
        <circle cx="14.7" cy="11.3" r="1.4" fill="#0B2451" />
        {/* smile */}
        <path d="M9.5 14.2 Q12 15.6 14.5 14.2" stroke="#0B2451" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}
