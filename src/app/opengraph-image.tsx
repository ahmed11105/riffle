import { ImageResponse } from "next/og";

export const alt = "Riffle, Daily song-guessing game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1a140c",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              background: "#fbbf24",
              borderRadius: 28,
              border: "8px solid #1c1917",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 0 0 rgba(0,0,0,0.9)",
            }}
          >
            <svg viewBox="0 0 24 24" width="80" height="80" fill="#1c1917">
              <rect x="3" y="9" width="2.5" height="6" rx="1" />
              <rect x="7" y="6" width="2.5" height="12" rx="1" />
              <rect x="11" y="3" width="2.5" height="18" rx="1" />
              <rect x="15" y="7" width="2.5" height="10" rx="1" />
              <rect x="19" y="10" width="2.5" height="4" rx="1" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 140,
              fontWeight: 900,
              color: "#fef3c7",
              letterSpacing: -4,
              lineHeight: 1,
            }}
          >
            Riffle
          </div>
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: "#fef3c7",
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          Name the tune.
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: "#fbbf24",
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: -2,
            marginTop: 4,
          }}
        >
          One second is all you need.
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "rgba(254, 243, 199, 0.6)",
            marginTop: 40,
            textTransform: "uppercase",
            letterSpacing: 4,
          }}
        >
          Daily · Solo · Rooms
        </div>
      </div>
    ),
    size,
  );
}
