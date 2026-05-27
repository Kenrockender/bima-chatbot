export function EscalationCard({
  whatsapp,
  email,
  title,
  body,
  whatsappLabel,
  emailLabel,
}: {
  whatsapp: string;
  email: string;
  title: string;
  body: string;
  whatsappLabel: string;
  emailLabel: string;
}) {
  const waNumber = whatsapp.replace(/[^\d]/g, "");
  return (
    <div className="ml-[50px] mb-6 max-w-[78%] animate-riseIn">
      <div
        className="relative rounded-[20px] overflow-hidden shadow-card"
        style={{
          background:
            "linear-gradient(135deg, #003D7A 0%, #002854 60%, #001E3F 100%)",
        }}
      >
        {/* Yellow accent corner */}
        <span
          aria-hidden
          className="absolute top-0 right-0 w-32 h-32 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,210,0,0.35) 0%, transparent 70%)",
            transform: "translate(40%, -40%)",
          }}
        />
        <span
          aria-hidden
          className="absolute top-0 left-0 h-1 w-20"
          style={{ background: "#FFD200" }}
        />

        <div className="relative p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,210,0,0.18)" }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFD200"
                strokeWidth="2.2"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-bca-yellow">
              Need a human?
            </span>
          </div>

          <h4 className="text-white text-xl font-bold leading-tight mb-1.5">
            {title}
          </h4>
          <p className="text-white/75 text-[13.5px] mb-4 leading-relaxed max-w-md">
            {body}
          </p>

          <div className="flex flex-wrap gap-2.5">
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full font-semibold text-[13.5px] transition-all hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(160deg, #FFD200 0%, #E5B800 100%)",
                color: "#003D7A",
                boxShadow: "0 6px 16px -4px rgba(255,210,0,0.5)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.6 6.3A7.85 7.85 0 0 0 12.05 4c-4.4 0-8 3.6-8 8 0 1.4.4 2.8 1.1 4L4 20l4.1-1.1c1.2.6 2.5 1 3.9 1 4.4 0 8-3.6 8-8a8 8 0 0 0-2.4-5.6m-5.55 12.3c-1.25 0-2.45-.35-3.5-1l-.25-.15-2.6.7.7-2.55-.15-.25c-.7-1.15-1.1-2.45-1.1-3.75 0-3.7 3-6.65 6.65-6.65 1.8 0 3.45.7 4.7 1.95 1.25 1.25 1.95 2.9 1.95 4.7.05 3.65-3 6.65-6.65 6.65m3.7-4.95c-.2-.1-1.2-.6-1.35-.65-.2-.05-.3-.1-.45.1-.15.2-.5.65-.6.75-.1.15-.2.15-.4.05-.2-.1-.85-.3-1.6-1-.6-.55-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4l.3-.3c.1-.1.15-.2.2-.3a.45.45 0 0 0 0-.4c-.05-.1-.45-1.1-.65-1.5-.15-.4-.35-.35-.45-.35h-.4c-.15 0-.35.05-.55.25-.2.2-.7.7-.7 1.7 0 1 .75 2 .85 2.1.1.15 1.4 2.15 3.4 3 .45.2.85.3 1.15.4.5.15.9.15 1.25.05.4-.05 1.2-.5 1.35-.95.15-.5.15-.9.1-.95 0-.1-.15-.15-.35-.25"/>
              </svg>
              <span>{whatsappLabel}</span>
              <span className="opacity-80 font-normal">{whatsapp}</span>
            </a>
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full font-semibold text-[13.5px] text-white transition-all hover:bg-white/20"
              style={{
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.25)",
                backdropFilter: "blur(8px)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <span>{emailLabel}</span>
              <span className="opacity-70 font-normal">{email}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
