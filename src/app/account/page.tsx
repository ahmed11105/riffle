"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { Logo } from "@/components/branding/Logo";
import { MainNav } from "@/components/MainNav";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRiffs } from "@/lib/riffs/useRiffs";
import { PRO_MONTHLY_GBP, PRO_PERKS } from "@/lib/riffs/pro";
import { createClient } from "@/lib/supabase/client";

function formatGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AccountPage() {
  const { user, profile, streak, isAnonymous, isPro, loading, signOut } = useAuth();
  const { balance } = useRiffs();
  const router = useRouter();
  const [proLoading, setProLoading] = useState(false);
  const [proMsg, setProMsg] = useState<string | null>(null);
  const [signOutLoading, setSignOutLoading] = useState(false);

  // /account is the signed-in dashboard. Anonymous players go to /signin.
  useEffect(() => {
    if (loading) return;
    if (isAnonymous) router.replace("/signin");
  }, [loading, isAnonymous, router]);

  async function subscribePro() {
    if (!user) return;
    if (isAnonymous) {
      setProMsg("Sign in below before subscribing so your Pro perks stay with you.");
      return;
    }
    setProLoading(true);
    setProMsg(null);
    try {
      const res = await fetch("/api/stripe/subscribe", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setProMsg(json.error ?? "Couldn't start subscription.");
        return;
      }
      window.location.href = json.url;
    } finally {
      setProLoading(false);
    }
  }

  async function openProPortal() {
    setProLoading(true);
    setProMsg(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setProMsg(json.error ?? "Couldn't open subscription portal.");
        return;
      }
      window.location.href = json.url;
    } finally {
      setProLoading(false);
    }
  }

  async function handleSignOut() {
    setSignOutLoading(true);
    try {
      await signOut();
    } finally {
      setSignOutLoading(false);
    }
  }

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

        {/* Subscription */}
        <section className="rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
          <h2 className="text-xl font-black">
            {isPro ? "Pro subscription" : `Riffle Pro · ${formatGbp(PRO_MONTHLY_GBP)}/mo`}
          </h2>
          {isPro ? (
            <>
              <p className="mt-1 text-sm text-stone-600">
                Renews{" "}
                <strong>{formatDate(profile?.pro_current_period_end ?? null)}</strong>
                . Manage payment method, view invoices, or cancel anytime.
              </p>
              <button
                type="button"
                onClick={openProPortal}
                disabled={proLoading}
                className="mt-3 inline-flex items-center rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
              >
                {proLoading ? "Opening…" : "Manage subscription"}
              </button>
            </>
          ) : (
            <>
              <ul className="mt-2 ml-5 list-disc space-y-1 text-sm text-stone-700">
                {PRO_PERKS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={subscribePro}
                disabled={proLoading}
                className="mt-3 inline-flex items-center rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
              >
                {proLoading ? "Starting…" : "Subscribe to Pro"}
              </button>
            </>
          )}
          {proMsg && (
            <p className="mt-2 text-sm font-bold text-stone-700">{proMsg}</p>
          )}
        </section>

        {/* Sign out */}
        <section className="rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
          <h2 className="text-xl font-black">Sign out</h2>
          <p className="mt-1 text-sm text-stone-600">
            Signs you out on this device. Your account, streak, and Pro
            perks stay safe — sign back in any time with a magic link.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signOutLoading}
            className="mt-3 inline-flex items-center rounded-full border-4 border-stone-900 bg-stone-100 px-6 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
          >
            {signOutLoading ? "Signing out…" : "Sign out"}
          </button>
        </section>
      </div>
      )}
    </main>
  );
}

function DisplayNameEditor({
  currentName,
  isPro,
}: {
  currentName: string;
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
    if (next.length > 24) {
      setError("Max 24 characters.");
      return;
    }
    if (next === currentName) {
      setEditing(false);
      return;
    }
    if (!user) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("profiles")
      .update({ display_name: next })
      .eq("id", user.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshProfile();
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-black">{currentName}</h1>
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
