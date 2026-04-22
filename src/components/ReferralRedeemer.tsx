"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "riffle_ref_code";

// Capture ?ref= from any URL and stash it in localStorage. When the
// user later upgrades from anonymous -> identified (signs in with
// email), call the redeem RPC. Server-side rules enforce one
// redemption per email forever, no self-referral, etc.
export function ReferralRedeemer() {
  const search = useSearchParams();
  const { user, isAnonymous, refreshProfile } = useAuth();
  const attemptedRef = useRef(false);

  // Stash incoming ref code on first mount of any page.
  useEffect(() => {
    const code = search.get("ref");
    if (!code) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, code.toUpperCase());
    } catch {
      // Private mode / quota / etc — non-critical.
    }
  }, [search]);

  // Try to redeem once we know who the (signed-in) user is.
  useEffect(() => {
    if (!user || isAnonymous) return;
    if (attemptedRef.current) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!stored) return;
    attemptedRef.current = true;

    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("redeem_invite", { p_code: stored });
      // Whether it succeeded or failed for an irreversible reason,
      // clear so we don't retry on every render.
      const result = data as { ok?: boolean; error?: string } | null;
      const irreversibleErrors = new Set([
        "self_redemption",
        "already_redeemed",
        "invalid_code",
        "no_email",
      ]);
      const shouldClear =
        !error &&
        (result?.ok || (result?.error && irreversibleErrors.has(result.error)));
      if (shouldClear) {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
      if (result?.ok) {
        // Pull the new Riffs balance into the auth context.
        await refreshProfile();
      }
    })();
  }, [user, isAnonymous, refreshProfile]);

  return null;
}
