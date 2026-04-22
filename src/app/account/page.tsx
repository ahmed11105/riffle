"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { Logo } from "@/components/branding/Logo";
import { MainNav } from "@/components/MainNav";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRiffs } from "@/lib/riffs/useRiffs";

export default function AccountPage() {
  const { user, profile, streak, isAnonymous, isPro, loading } = useAuth();
  const { balance } = useRiffs();
  const router = useRouter();

  // /account is the signed-in profile page. Anonymous players go to /signin.
  useEffect(() => {
    if (loading) return;
    if (isAnonymous) router.replace("/signin");
  }, [loading, isAnonymous, router]);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10 text-amber-100">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <MainNav />
      </header>

      {/* While the redirect resolves for anon users, render nothing
          to avoid flashing a half-built dashboard. */}
      {(loading || isAnonymous) ? (
        <div className="mt-12 text-sm text-amber-100/60">Loading your account…</div>
      ) : (
      <div className="mt-8 w-full max-w-4xl space-y-6">
        {/* Identity card */}
        <section className="rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Signed in
          </p>
          <div className="mt-2">
            <DisplayNameEditor
              currentName={profile?.display_name ?? "Player"}
              currentTag={profile?.tag}
              isPro={isPro}
            />
          </div>
          {user?.email && (
            <p className="mt-2 text-sm text-stone-600">{user.email}</p>
          )}
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Current streak" value={streak?.current_streak ?? 0} suffix="days" />
          <Stat label="Best streak" value={streak?.longest_streak ?? 0} suffix="days" />
          <Stat label="Riffs" value={balance} />
          <Stat label="Level" value={profile?.level ?? 1} />
        </section>
      </div>
      )}
    </main>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "Sign in again to edit your name.",
  empty: "Name can't be empty.",
  too_long: "Max 24 characters.",
  name_full: "All tag slots for that name are taken — try a small variation.",
};

function DisplayNameEditor({
  currentName,
  currentTag,
  isPro,
}: {
  currentName: string;
  currentTag: number | null | undefined;
  isPro: boolean;
}) {
  const { user, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    setDraft(currentName);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    const next = draft.trim();
    if (!next) {
      setError("Name can't be empty.");
      return;
    }
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      // Server-side route avoids the navigator.locks Web Lock that
      // supabase-js uses in the browser (which can hang on iOS Safari).
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      let result: { ok?: boolean; error?: string } | null = null;
      try {
        const res = await fetch("/api/account/display-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: next }),
          signal: ctrl.signal,
        });
        result = (await res.json()) as { ok?: boolean; error?: string };
      } finally {
        clearTimeout(timer);
      }
      if (!result?.ok) {
        setError(ERROR_MESSAGES[result?.error ?? ""] ?? result?.error ?? "Couldn't save. Try again.");
        return;
      }
      await refreshProfile();
      setEditing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save. Try again.";
      setError(msg.includes("aborted") ? "Request timed out, try again." : msg);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-1">
          <h1 className="text-3xl font-black">{currentName}</h1>
          {currentTag != null && (
            <span className="font-mono text-base font-bold text-stone-400">
              #{currentTag.toString().padStart(4, "0")}
            </span>
          )}
        </div>
        {isPro && (
          <span className="rounded-full border-2 border-stone-900 bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-stone-900">
            Pro
          </span>
        )}
        <button
          type="button"
          onClick={start}
          aria-label="Edit display name"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border-2 border-stone-900 bg-stone-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] hover:bg-amber-200 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={24}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          className="min-w-0 flex-1 rounded-full border-4 border-stone-900 bg-stone-100 px-4 py-2 text-2xl font-black text-stone-900 focus:outline-none focus:ring-4 focus:ring-amber-300"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          aria-label="Save"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-stone-900 bg-emerald-400 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          aria-label="Cancel"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-stone-900 bg-stone-200 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-stone-500">
        Anyone can pick the same name — your <span className="font-mono">#tag</span>{" "}
        will be assigned automatically to keep your handle unique.
      </p>
      {error && (
        <p className="text-xs font-bold text-rose-700">{error}</p>
      )}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl border-4 border-stone-900 bg-stone-50 p-4 text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
      <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">
        {value}
        {suffix && (
          <span className="ml-1 text-sm font-bold text-stone-500">{suffix}</span>
        )}
      </p>
    </div>
  );
}
