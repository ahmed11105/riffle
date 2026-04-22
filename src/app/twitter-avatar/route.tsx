import { ImageResponse } from "next/og";

// Twitter profile picture. 800×800 PNG, designed to crop cleanly to a
// circle (Twitter applies a CSS circle mask). The amber fills the canvas
// edge-to-edge so the cropped circle is solid amber with the bars
// centred — readable at avatar size where a wordmark wouldn't be.
//
// Visit https://riffle.cc/twitter-avatar to download.
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#fbbf24",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg viewBox="0 0 24 24" width="520" height="520" fill="#1c1917">
          <rect x="3" y="9" width="2.5" height="6" rx="1" />
          <rect x="7" y="6" width="2.5" height="12" rx="1" />
          <rect x="11" y="3" width="2.5" height="18" rx="1" />
          <rect x="15" y="7" width="2.5" height="10" rx="1" />
          <rect x="19" y="10" width="2.5" height="4" rx="1" />
        </svg>
      </div>
    ),
    { width: 800, height: 800 },
  );
}
