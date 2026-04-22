"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Logo } from "@/components/branding/Logo";
import { MainNav } from "@/components/MainNav";
import { useAuth } from "@/lib/auth/AuthProvider";
import { PRO_MONTHLY_GBP, PRO_PERKS } from "@/lib/riffs/pro";

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

export default function SettingsPage() {
  const { user, profile, isAnonymous, isPro, loading, signOut } = useAuth();
  const router = useRouter();
  const [proLoading, setProLoading] = useState(false);
  const [proMsg, setProMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (isAnonymous) router.replace("/signin");
  }, [loading, isAnonymous, router]);

  async function subscribePro() {
    if (!user || isAnonymous) return;
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

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10 text-amber-100">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <MainNav />
      </header>

      {(loading || isAnonymous) ? (
        <div className="mt-12 text-sm text-amber-100/60">Loading settings…</div>
      ) : (
        <div className="mt-8 w-full max-w-4xl space-y-6">
          <h1 className="text-3xl font-black">Settings</h1>

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

          {/* Danger zone */}
          <DangerZone signOut={signOut} />
        </div>
      )}
    </main>
  );
}

function DangerZone({ signOut }: { signOut: () => Promise<void> }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Couldn't delete account. Try again.");
        setDeleting(false);
        return;
      }
      // Tear down the local session and ship them home.
      await signOut();
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-3xl border-4 border-rose-400 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-rose-600" />
        <h2 className="text-xl font-black">Delete account</h2>
      </div>
      <p className="mt-2 text-sm text-stone-600">
        Permanently deletes your Riffle account, profile, streak, Riffs
        balance, achievements, and play history. If you have an active
        Pro subscription, it will be cancelled. This cannot be undone.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 inline-flex items-center rounded-full border-2 border-rose-600 bg-stone-50 px-5 py-2 text-sm font-black text-rose-700 hover:bg-rose-50"
        >
          Delete my account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-bold text-stone-900">
            Type <code className="rounded bg-stone-200 px-1.5 py-0.5 font-mono text-xs">DELETE</code>{" "}
            below to confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={deleting}
            className="w-full max-w-xs rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-2 font-mono font-black text-stone-900 focus:outline-none focus:ring-4 focus:ring-rose-300"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={deleting || confirmText !== "DELETE"}
              className="rounded-full border-2 border-stone-900 bg-rose-500 px-5 py-2 text-sm font-black text-stone-50 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setConfirmText("");
                setError(null);
              }}
              disabled={deleting}
              className="rounded-full border-2 border-stone-900 bg-stone-100 px-5 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-sm font-bold text-rose-700">{error}</p>
          )}
        </div>
      )}
    </section>
  );
}
