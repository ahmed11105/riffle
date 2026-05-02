"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { openDailyRiffs } from "@/lib/dailyRiffs";

const AUTO_SHOWN_KEY = "riffle:daily-wheel:auto-shown";

// Auto-pop the daily spin on home page mount, once per UTC day, only
// if the wheel hasn't been spun yet. After it shows once we set a
// localStorage flag so navigating to the home page again on the same
// day doesn't keep re-popping it.
//
// Mounted on the home page only. Other pages don't surface the
// wheel automatically — the player can still open it from the
// ribbon's Daily icon at any time.
export function DailyWheelAutoShow() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(AUTO_SHOWN_KEY) === today) return;
    } catch {}

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_today_claims");
      if (cancelled || error) return;
      const claims = (data as string[]) ?? [];
      if (claims.includes("daily_wheel")) {
        // Already spun — mark shown so we don't even bother fetching
        // again for the rest of the day.
        try {
          localStorage.setItem(AUTO_SHOWN_KEY, today);
        } catch {}
        return;
      }
      // Tiny delay so onboarding (if it pops on a brand new account)
      // mounts first and the wheel doesn't fight for the same frame.
      window.setTimeout(() => {
        if (cancelled) return;
        openDailyRiffs();
        try {
          localStorage.setItem(AUTO_SHOWN_KEY, today);
        } catch {}
      }, 700);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  return null;
}
