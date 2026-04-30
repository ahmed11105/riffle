"use client";

import { useEffect, useRef } from "react";

// Wraps a Google AdSense ad unit. Renders the standard <ins> tag and
// kicks AdSense to fill it on mount. If `slotId` is empty (we don't
// have an AdSense unit ID yet), shows a neutral fallback so the
// surrounding UI still has visual weight.
//
// Once AdSense approves the site:
//   1. Create a Display ad unit in the AdSense dashboard.
//   2. Copy its data-ad-slot value (a long numeric string).
//   3. Set the corresponding entry in lib/adslots.ts. Done — no
//      component changes needed.

const AD_CLIENT = "ca-pub-7586421136621055";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export function AdSlot({
  slotId,
  format = "auto",
  className = "",
  fallback,
}: {
  slotId: string | null;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  className?: string;
  fallback?: React.ReactNode;
}) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!slotId) return;
    if (typeof window === "undefined") return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // Silently swallow — AdSense throws if the same <ins> is pushed
      // twice (StrictMode in dev does this) or if adsbygoogle.js
      // hasn't loaded yet (ad-blocker, slow network).
      console.warn("[adsense] push failed:", e);
    }
  }, [slotId]);

  if (!slotId) {
    return (
      <div className={className}>
        {fallback ?? (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wider text-stone-500">
            Ad space
          </div>
        )}
      </div>
    );
  }

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className}`}
      style={{ display: "block" }}
      data-ad-client={AD_CLIENT}
      data-ad-slot={slotId}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
