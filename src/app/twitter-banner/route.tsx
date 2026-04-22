import { ImageResponse } from "next/og";

// Twitter header banner. 1500×500 PNG. Twitter overlays the user's
// circular avatar over the bottom-left ~12-15% of the banner, so the
// left ~320px gutter is dead space — keep important content right of
// that.
//
// Composition:
//   - Background: dark stone with subtle texture grid
//   - Top bar: clip ladder pills (1s 2s 4s 8s 16s) like in-game
//   - Center: stylised guess input pill with a mouse cursor hovering
//     over it ("Guess the song…")
//   - Right: wordmark + tagline
//   - Floating annotation pills with the same chunky border + drop
//     shadow as the in-app buttons
//
// Visit https://riffle.cc/twitter-banner to download.

export async function GET() {
  // Reusable shadow + border treatment (matches the app's CSS):
  // border 4px solid #1c1917, shadow 0 4px 0 0 rgba(0,0,0,0.9)
  const cardBorder = "4px solid #1c1917";
  const cardShadow = "0 6px 0 0 rgba(0,0,0,0.9)";
  const pillShadow = "0 3px 0 0 rgba(0,0,0,0.9)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(ellipse at 60% 40%, #2a1f12 0%, #1a140c 70%)",
          display: "flex",
          position: "relative",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "40px 60px 40px 320px",
          overflow: "hidden",
        }}
      >
        {/* Subtle dotted grid background for texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(254,243,199,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            display: "flex",
          }}
        />

        {/* Left column: clip ladder + guess input mockup */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            zIndex: 1,
            flex: 1,
            justifyContent: "center",
          }}
        >
          {/* Clip ladder pills — 4s highlighted as if currently playing */}
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { s: "1s", solved: true },
              { s: "2s", solved: true },
              { s: "4s", current: true },
              { s: "8s" },
              { s: "16s" },
            ].map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 38,
                  minWidth: 60,
                  padding: "0 14px",
                  borderRadius: 999,
                  border: cardBorder,
                  background: p.current
                    ? "#fbbf24"
                    : p.solved
                      ? "#34d399"
                      : "#44403c",
                  color: p.current || p.solved ? "#1c1917" : "#a8a29e",
                  fontSize: 18,
                  fontWeight: 900,
                  boxShadow: pillShadow,
                }}
              >
                {p.s}
              </div>
            ))}
          </div>

          {/* Guess input mockup with cursor */}
          <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                width: 460,
                height: 64,
                padding: "0 22px",
                borderRadius: 999,
                border: cardBorder,
                background: "#fafaf9",
                color: "#78716c",
                fontSize: 22,
                fontWeight: 700,
                boxShadow: cardShadow,
              }}
            >
              Guess the song…
            </div>
            {/* Mouse cursor SVG hovering at the right edge of the input */}
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              style={{ marginLeft: -28, marginTop: 18 }}
            >
              <path
                d="M5 3 L5 19 L9 15 L11.5 21 L14 20 L11.5 14 L18 14 Z"
                fill="#fef3c7"
                stroke="#1c1917"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Annotation pill — sits under the input, slightly offset */}
          <div style={{ display: "flex", gap: 14, marginTop: -4 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 999,
                border: cardBorder,
                background: "#fbbf24",
                color: "#1c1917",
                fontSize: 16,
                fontWeight: 900,
                boxShadow: pillShadow,
              }}
            >
              ▶ Listen
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 999,
                border: cardBorder,
                background: "#1c1917",
                color: "#fcd34d",
                fontSize: 14,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                boxShadow: pillShadow,
              }}
            >
              🟧🟧🟩 Share result
            </div>
          </div>
        </div>

        {/* Right column: wordmark + tagline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 14,
            zIndex: 1,
            paddingLeft: 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                background: "#fbbf24",
                borderRadius: 16,
                border: cardBorder,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: cardShadow,
              }}
            >
              <svg viewBox="0 0 24 24" width="42" height="42" fill="#1c1917">
                <rect x="3" y="9" width="2.5" height="6" rx="1" />
                <rect x="7" y="6" width="2.5" height="12" rx="1" />
                <rect x="11" y="3" width="2.5" height="18" rx="1" />
                <rect x="15" y="7" width="2.5" height="10" rx="1" />
                <rect x="19" y="10" width="2.5" height="4" rx="1" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 76,
                fontWeight: 900,
                color: "#fef3c7",
                letterSpacing: -2,
                lineHeight: 1,
              }}
            >
              Riffle
            </div>
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: "#fef3c7",
              lineHeight: 1.1,
              textAlign: "right",
              letterSpacing: -0.5,
            }}
          >
            Name the tune.
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: "#fbbf24",
              lineHeight: 1.1,
              textAlign: "right",
              letterSpacing: -0.5,
            }}
          >
            One second is all you need.
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "rgba(254, 243, 199, 0.6)",
              marginTop: 6,
              textTransform: "uppercase",
              letterSpacing: 4,
            }}
          >
            riffle.cc
          </div>
        </div>
      </div>
    ),
    { width: 1500, height: 500 },
  );
}
