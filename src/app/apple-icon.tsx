import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        <svg viewBox="0 0 24 24" width="120" height="120" fill="#1c1917">
          <rect x="3" y="9" width="2.5" height="6" rx="1" />
          <rect x="7" y="6" width="2.5" height="12" rx="1" />
          <rect x="11" y="3" width="2.5" height="18" rx="1" />
          <rect x="15" y="7" width="2.5" height="10" rx="1" />
          <rect x="19" y="10" width="2.5" height="4" rx="1" />
        </svg>
      </div>
    ),
    size,
  );
}
