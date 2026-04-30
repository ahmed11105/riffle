"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  // Riot/Discord-style 4-digit disambiguator. Combined with
  // display_name forms a globally unique handle: "Alex#0042".
  tag: number | null;
  avatar_url: string | null;
  coin_balance: number;
  xp: number;
  level: number;
  is_pro: boolean;
  pro_current_period_end: string | null;
  pro_status: string | null;
  // Banked free hints, keyed by HintKind. Decremented atomically by
  // consume_hint(); only falls back to Riffs spending when 0.
  hint_inventory: Record<string, number>;
  // 7-day login calendar progress. login_day_index is the day they
  // last claimed on (1..7); login_last_claimed_on is the UTC date.
  login_day_index: number;
  login_last_claimed_on: string | null;
  // True once the user has bought the £1.99 starter pack. Eligibility
  // gate for the StarterPackOffer banner.
  starter_pack_claimed: boolean;
};

export type Streak = {
  current_streak: number;
  longest_streak: number;
  last_play_date: string | null;
  freezes_available: number;
  // Saved when the streak resets (>=3 days). Within 48h of broken_at,
  // the user can pay Riffs to restore current_streak to this value.
  pre_break_streak: number;
  broken_at: string | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  streak: Streak | null;
  loading: boolean;
  isAnonymous: boolean;
  isPro: boolean;
  refreshProfile: () => Promise<void>;
  refreshStreak: () => Promise<void>;
  // Patch profile state in-place after a server mutation already
  // returned the new field values. Avoids the round-trip + Web Lock
  // risk of refreshProfile.
  mergeProfile: (partial: Partial<Profile>) => void;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [loading, setLoading] = useState(true);

  // Both profile and streak now go through /api/account/profile so the
  // browser supabase-js Web Lock can't hang the read. Server route
  // uses the admin client + cookie auth.
  const fetchProfileAndStreak = useCallback(async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch("/api/account/profile", { signal: ctrl.signal });
      if (!res.ok) {
        console.warn("Profile fetch failed:", res.status);
        return;
      }
      const json = (await res.json()) as {
        profile?: Profile | null;
        streak?: Streak | null;
      };
      if (json.profile) setProfile(json.profile);
      if (json.streak) setStreak(json.streak);
    } catch (e) {
      console.warn("Profile fetch errored:", e);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  // Locally patch the profile state without a network round-trip. Used
  // after a server mutation already returned the new field values, so
  // we don't need to re-fetch the whole row (and don't risk the Web
  // Lock hanging the refresh).
  const mergeProfile = useCallback((partial: Partial<Profile>) => {
    setProfile((p) => (p ? { ...p, ...partial } : p));
  }, []);

  // Sign in anonymously on first load if there's no session yet.
  // Anonymous users get a real auth.users row + profile/streak via the
  // handle_new_user() trigger, so coin_balance / streaks just work.
  const ensureSession = useCallback(async () => {
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing) return existing;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn("Anonymous sign-in failed:", error.message);
      return null;
    }
    return data.session;
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    // Hard fallback so the UI never gets stuck on "loading" if Supabase's
    // Web Lock gets stolen mid-init (iOS Safari bfcache, incognito tabs).
    // We let onAuthStateChange fill in user/session/profile when it eventually
    // resolves; the only goal here is to release the loading gate.
    const failsafe = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2000);

    (async () => {
      try {
        const initial = await ensureSession();
        if (!mounted) return;
        setSession(initial);
        setUser(initial?.user ?? null);
        setLoading(false);
        if (initial?.user) {
          fetchProfileAndStreak();
        }
      } catch (e) {
        console.warn("Auth init failed, will rely on onAuthStateChange:", e);
        if (mounted) setLoading(false);
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchProfileAndStreak();
        } else {
          setProfile(null);
          setStreak(null);
        }
      },
    );

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.subscription.unsubscribe();
    };
  }, [ensureSession, fetchProfileAndStreak, supabase]);

  const refreshProfile = useCallback(async () => {
    await fetchProfileAndStreak();
  }, [fetchProfileAndStreak]);

  const refreshStreak = useCallback(async () => {
    await fetchProfileAndStreak();
  }, [fetchProfileAndStreak]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      // Magic-link upgrade. Supabase will keep the existing user_id and
      // simply attach the email identity, so progress/Riffs are preserved.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    // Sign-out goes through a server-side route (which actually
    // clears the auth cookies via @supabase/ssr's cookie writer) and
    // then we hard-reload the page. Doing it client-side via
    // supabase.auth.signOut() can hang on the navigator.locks Web
    // Lock and skip cookie clearing — the next refresh would then
    // resurrect the session.
    try {
      await fetch("/api/account/signout", { method: "POST" });
    } catch (e) {
      console.warn("signout request failed:", e);
    }
    // Full reload kills any in-memory session state and forces the
    // AuthProvider to re-mount with cleared cookies, which then
    // creates a fresh anonymous session.
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }, []);

  const isAnonymous = !!user?.is_anonymous;
  const isPro = (() => {
    if (!profile?.is_pro) return false;
    if (!profile.pro_current_period_end) return true;
    return new Date(profile.pro_current_period_end).getTime() > Date.now();
  })();

  // Pro perk: 1 streak freeze auto-granted every 7 days, capped at 2.
  // The RPC is rate-limited server-side, so calling it on every Pro
  // user load is safe (and necessary, since this is a web app with no
  // background jobs of our own). Fires once per session per user.
  const freezeGrantedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPro || !user?.id) return;
    if (freezeGrantedRef.current === user.id) return;
    freezeGrantedRef.current = user.id;
    supabase.rpc("grant_weekly_freeze").then(({ data, error }) => {
      if (error) {
        console.warn("grant_weekly_freeze failed:", error.message);
        return;
      }
      const result = data as { granted?: boolean } | null;
      if (result?.granted) refreshStreak();
    });
  }, [isPro, user?.id, supabase, refreshStreak]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        streak,
        loading,
        isAnonymous,
        isPro,
        refreshProfile,
        refreshStreak,
        mergeProfile,
        signInWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
