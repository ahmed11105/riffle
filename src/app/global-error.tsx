"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Riffle global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a140c",
          color: "#fef3c7",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#fafaf9",
            color: "#1c1917",
            border: "4px solid #1c1917",
            borderRadius: 24,
            padding: "2rem",
            boxShadow: "0 8px 0 0 rgba(0,0,0,0.9)",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.875rem", fontWeight: 900, margin: 0 }}>
            Riffle hit a sour note.
          </h1>
          <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#57534e" }}>
            Something went wrong loading the app shell. Try reloading.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "1rem",
                fontFamily: "monospace",
                fontSize: 10,
                color: "#a8a29e",
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.25rem",
              padding: "0.75rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 900,
              background: "#fbbf24",
              color: "#1c1917",
              border: "4px solid #1c1917",
              borderRadius: 9999,
              cursor: "pointer",
              boxShadow: "0 4px 0 0 rgba(0,0,0,0.9)",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
