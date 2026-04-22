"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/analytics/consent";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  function decide(status: "granted" | "denied") {
    setConsent(status);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie and analytics preferences"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border-4 border-stone-900 bg-stone-50 p-4 text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)] sm:p-5">
        <p className="text-sm sm:text-base">
          We use a sign-in cookie so the game remembers you. We&rsquo;d also
          like to use{" "}
          <strong>privacy-friendly analytics</strong> to see which features
          work, but only if you say yes. See our{" "}
          <Link
            href="/privacy"
            className="font-bold text-amber-700 underline"
          >
            privacy policy
          </Link>
          .
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-2 text-xs font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
          >
            Decline analytics
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-2 text-xs font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
