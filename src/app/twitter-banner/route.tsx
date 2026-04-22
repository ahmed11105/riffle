import { ImageResponse } from "next/og";

// Twitter header banner. 1500×500 PNG. Twitter overlays the user's
// circular avatar over the bottom-left ~12% of the banner, so the left
// gutter (~250px wide, ~250px tall from the bottom) is dead space —
// keep the wordmark and tagline right of that.
//
// Visit https://riffle.cc/twitter-banner to download.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1a140c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 80px 0 320px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Decorative bars on the right edge, full height, low-opacity */}
        <div
          style={{
            position: "absolute",
            right: 80,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {[120, 200, 320, 240, 160, 280, 100].map((h, i) => (
            <div
              key={i}
              style={{
                width: 24,
                height: h,
                background: "#fbbf24",
                opacity: 0.18,
                borderRadius: 12,
              }}
            />
          ))}
        </div>

        {/* Wordmark + tagline + URL block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 76,
                height: 76,
                background: "#fbbf24",
                borderRadius: 18,
                border: "5px solid #1c1917",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 0 0 rgba(0,0,0,0.9)",
              }}
            >
              <svg viewBox="0 0 24 24" width="50" height="50" fill="#1c1917">
                <rect x="3" y="9" width="2.5" height="6" rx="1" />
                <rect x="7" y="6" width="2.5" height="12" rx="1" />
                <rect x="11" y="3" width="2.5" height="18" rx="1" />
                <rect x="15" y="7" width="2.5" height="10" rx="1" />
                <rect x="19" y="10" width="2.5" height="4" rx="1" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 96,
                fontWeight: 900,
                color: "#fef3c7",
                letterSpacing: -3,
                lineHeight: 1,
              }}
            >
              Riffle
            </div>
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#fef3c7",
              lineHeight: 1.05,
              letterSpacing: -1,
            }}
          >
            Name the tune.
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#fbbf24",
              lineHeight: 1.05,
              letterSpacing: -1,
            }}
          >
            One second is all you need.
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(254, 243, 199, 0.65)",
              marginTop: 18,
              textTransform: "uppercase",
              letterSpacing: 4,
            }}
          >
            Daily · riffle.cc
          </div>
        </div>
      </div>
    ),
    { width: 1500, height: 500 },
  );
}
