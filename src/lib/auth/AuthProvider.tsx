"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  coin_balance: number;
  xp: number;
  level: number;
  is_pro: boolean;
  pro_current_period_end: string | null;
  pro_status: string | null;
};

export type Streak = {
  current_streak: number;
  longest_streak: number;
  last_play_date: string | null;
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

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, display_name, avatar_url, coin_balance, xp, level, is_pro, pro_current_period_end, pro_status",
        )
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.warn("Profile fetch failed:", error.message);
        return;
      }
      if (data) setProfile(data as Profile);
    },
    [supabase],
  );

  const fetchStreak = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("streaks")
        .select("current_streak, longest_streak, last_play_date")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.warn("Streak fetch failed:", error.message);
        return;
      }
      if (data) setStreak(data as Streak);
    },
    [supabase],
  );

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
    }, 5000);

    (async () => {
      try {
        const initial = await ensureSession();
        if (!mounted) return;
        setSession(initial);
        setUser(initial?.user ?? null);
        if (initial?.user) {
          await Promise.all([
            fetchProfile(initial.user.id),
            fetchStreak(initial.user.id),
          ]);
        }
      } catch (e) {
        console.warn("Auth init failed, will rely on onAuthStateChange:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await Promise.all([
            fetchProfile(newSession.user.id),
            fetchStreak(newSession.user.id),
          ]);
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
  }, [ensureSession, fetchProfile, fetchStreak, supabase]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const refreshStreak = useCallback(async () => {
    if (user?.id) await fetchStreak(user.id);
  }, [user, fetchStreak]);

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
    await supabase.auth.signOut();
    setProfile(null);
    setStreak(null);
    // Re-create an anonymous session so the player can keep playing.
    await ensureSession();
  }, [supabase, ensureSession]);

  const isAnonymous = !!user?.is_anonymous;
  const isPro = (() => {
    if (!profile?.is_pro) return false;
    if (!profile.pro_current_period_end) return true;
    return new Date(profile.pro_current_period_end).getTime() > Date.now();
  })();

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
