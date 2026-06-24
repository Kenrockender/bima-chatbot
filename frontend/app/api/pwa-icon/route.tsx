import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const size = Math.min(
    1024,
    Math.max(48, parseInt(req.nextUrl.searchParams.get("size") || "512", 10)),
  );
  const s = (pct: number) => Math.round((size * pct) / 100);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(180deg, #9FE3DE 0%, #5FC5C0 55%, #3FAFAA 100%)",
          borderRadius: s(20),
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Shine overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(70% 60% at 35% 25%, rgba(255,255,255,0.4), transparent)",
          }}
        />

        {/* Antenna stem */}
        <div
          style={{
            position: "absolute",
            top: s(13),
            left: "50%",
            marginLeft: -s(1),
            width: s(2),
            height: s(7),
            background: "#1B3F7A",
            borderRadius: s(1),
          }}
        />
        {/* Antenna tip */}
        <div
          style={{
            position: "absolute",
            top: s(9),
            left: "50%",
            marginLeft: -s(2.5),
            width: s(5),
            height: s(5),
            borderRadius: "50%",
            background: "#1B3F7A",
          }}
        />

        {/* Headphone left */}
        <div
          style={{
            position: "absolute",
            left: s(14),
            top: s(34),
            width: s(7),
            height: s(13),
            borderRadius: s(3.5),
            background: "#1B3F7A",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: s(16),
            top: s(36),
            width: s(3.5),
            height: s(8),
            borderRadius: s(2),
            background: "#3FAFAA",
          }}
        />
        {/* Headphone right */}
        <div
          style={{
            position: "absolute",
            right: s(14),
            top: s(34),
            width: s(7),
            height: s(13),
            borderRadius: s(3.5),
            background: "#1B3F7A",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: s(16),
            top: s(36),
            width: s(3.5),
            height: s(8),
            borderRadius: s(2),
            background: "#3FAFAA",
          }}
        />

        {/* Headband */}
        <div
          style={{
            position: "absolute",
            top: s(24),
            left: s(17),
            right: s(17),
            height: s(10),
            borderTop: `${Math.max(2, s(1.5))}px solid #1B3F7A`,
            borderRadius: `${s(30)}px ${s(30)}px 0 0`,
          }}
        />

        {/* Head */}
        <div
          style={{
            width: s(56),
            height: s(42),
            background: "#ffffff",
            borderRadius: s(16),
            border: `${Math.max(2, s(1.5))}px solid #1B3F7A`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginTop: s(8),
          }}
        >
          {/* Eyes */}
          <div style={{ display: "flex", gap: s(10), marginBottom: s(3) }}>
            <div
              style={{
                width: s(7),
                height: s(4),
                background: "#1B3F7A",
                borderRadius: `${s(4)}px ${s(4)}px ${s(1)}px ${s(1)}px`,
              }}
            />
            <div
              style={{
                width: s(7),
                height: s(4),
                background: "#1B3F7A",
                borderRadius: `${s(4)}px ${s(4)}px ${s(1)}px ${s(1)}px`,
              }}
            />
          </div>
          {/* Blush */}
          <div style={{ display: "flex", gap: s(22), marginBottom: s(1) }}>
            <div
              style={{
                width: s(4),
                height: s(4),
                borderRadius: "50%",
                background: "#F8B4B4",
                opacity: 0.7,
              }}
            />
            <div
              style={{
                width: s(4),
                height: s(4),
                borderRadius: "50%",
                background: "#F8B4B4",
                opacity: 0.7,
              }}
            />
          </div>
          {/* Smile */}
          <div
            style={{
              width: s(14),
              height: s(7),
              borderRadius: `0 0 ${s(7)}px ${s(7)}px`,
              borderBottom: `${Math.max(2, s(1.5))}px solid #1B3F7A`,
              borderLeft: `${Math.max(2, s(1.5))}px solid #1B3F7A`,
              borderRight: `${Math.max(2, s(1.5))}px solid #1B3F7A`,
            }}
          />
        </div>

        {/* Chat bubbles */}
        <div
          style={{
            position: "absolute",
            bottom: s(10),
            left: s(20),
            width: s(22),
            height: s(16),
            background: "#ffffff",
            borderRadius: s(5),
            border: `${Math.max(1, s(1))}px solid #1B3F7A`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: s(14),
            right: s(20),
            width: s(17),
            height: s(12),
            background: "#ffffff",
            borderRadius: s(5),
            border: `${Math.max(1, s(1))}px solid #1B3F7A`,
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
