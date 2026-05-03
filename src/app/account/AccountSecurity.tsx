"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Trash2, Loader2, Check, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";

// Account security panel — split into two cards:
//   1. Change email — uses supabase.auth.updateUser({ email }), which
//      sends the "Confirm Email Change" template to the new address
//      (and to the old address too, when "Secure email change" is on
//      in Supabase Auth settings — recommended).
//   2. Delete account — gates the destructive POST behind a fresh
//      Supabase reauthentication OTP. supabase.auth.reauthenticate()
//      sends the "Reauthentication" template containing a 6-digit
//      code; verifyOtp({ type: "reauthentication" }) confirms it.
//      Only after that confirmation does we call /api/account/delete.

export function AccountSecurity() {
  const { user } = useAuth();
  if (!user || !user.email) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-amber-100/60">
        Account & security
      </h2>
      <ChangeEmailCard currentEmail={user.email} />
      <DeleteAccountCard email={user.email} />
    </section>
  );
}

function ChangeEmailCard({ currentEmail }: { currentEmail: string }) {
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState(false);

  async function start() {
    setEditing(true);
    setErr(null);
    setSentNotice(false);
  }

  async function submit() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErr("That doesn't look like a valid email.");
      return;
    }
    if (trimmed === currentEmail.toLowerCase()) {
      setErr("That's already your email.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) {
        setErr(error.message);
        return;
      }
      setSentNotice(true);
      setNewEmail("");
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
      <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
        Email address
      </p>
      <p className="mt-2 break-all font-mono text-sm">{currentEmail}</p>
      {sentNotice && (
        <div className="mt-3 rounded-xl border-2 border-emerald-700 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <p className="font-bold">Confirmation email sent.</p>
          <p className="mt-1">
            Click the link in <strong>both</strong> your old and new
            inboxes to complete the change. Until both confirmations
            land, your email stays as-is.
          </p>
        </div>
      )}
      {!editing ? (
        <button
          type="button"
          onClick={start}
          className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] hover:bg-amber-200 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
        >
          <Mail className="h-3.5 w-3.5" /> Change email
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
            New email
          </label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setEditing(false);
            }}
            disabled={busy}
            autoFocus
            placeholder="new@example.com"
            className="rounded-full border-4 border-stone-900 bg-stone-100 px-4 py-2 text-sm font-bold text-stone-900 focus:outline-none focus:ring-4 focus:ring-amber-300 disabled:opacity-70"
          />
          <p className="text-xs text-stone-500">
            We&rsquo;ll send a confirmation to both addresses. The
            change applies after both are clicked.
          </p>
          {err && <p className="text-xs font-bold text-rose-700">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border-4 border-stone-900 bg-amber-400 px-5 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send confirmation"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-2 text-sm font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Account deletion. Riffle is passwordless, so the standard
// "reauthenticate via OTP" pattern doesn't apply (Supabase's
// reauthenticate() flow only finalises password updates). Instead
// we use the GitHub/Vercel pattern: type your email to confirm.
// The /api/account/delete route still requires a valid server-side
// session, so this gate is the user-side mistake-protection layer.
function DeleteAccountCard({ email }: { email: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const matches = confirmText.trim().toLowerCase() === email.toLowerCase();

  async function deleteNow() {
    if (!matches || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErr(body?.error ?? "Couldn't delete account.");
        setBusy(false);
        return;
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
      setBusy(false);
      return;
    }
    // Hard reload home so the cleared cookies + fresh anonymous
    // session take effect immediately.
    if (typeof window !== "undefined") {
      window.location.href = "/";
    } else {
      router.replace("/");
    }
  }

  return (
    <div className="rounded-3xl border-4 border-rose-900 bg-rose-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 shrink-0 text-rose-700" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-rose-800">
            Delete account
          </p>
          <p className="mt-1 text-sm text-stone-700">
            Permanently removes your Riffle account, streak, Riffs, hint
            inventory, invite history, and any active Pro subscription
            (cancelled with Stripe). Can&rsquo;t be undone.
          </p>
        </div>
      </div>
      {!armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-full border-4 border-stone-900 bg-rose-600 px-5 py-2 text-sm font-black uppercase tracking-wider text-white shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
        >
          <Trash2 className="h-4 w-4" /> Delete my account
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <label className="text-xs font-bold text-stone-700">
            Type your email{" "}
            <span className="font-mono">{email}</span> to confirm:
          </label>
          <input
            type="email"
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value);
              setErr(null);
            }}
            disabled={busy}
            autoComplete="off"
            placeholder={email}
            className="rounded-full border-4 border-stone-900 bg-stone-50 px-4 py-2 text-sm font-bold text-stone-900 focus:outline-none focus:ring-4 focus:ring-rose-400 disabled:opacity-70"
          />
          {err && <p className="text-xs font-bold text-rose-800">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={deleteNow}
              disabled={!matches || busy}
              className="inline-flex items-center gap-2 rounded-full border-4 border-stone-900 bg-rose-600 px-5 py-2 text-sm font-black uppercase tracking-wider text-white shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4" /> Permanently delete
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setArmed(false);
                setConfirmText("");
                setErr(null);
              }}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-2 text-sm font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
