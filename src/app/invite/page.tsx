"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, Check, Gift, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { copyText } from "@/lib/clipboard";

const REWARD = 100;

const EMAIL_INVITE_ERRORS: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email address.",
  self_invite: "You can't invite yourself.",
  already_redeemed:
    "Someone already used a Riffle invite for that email. Try a different friend.",
  already_registered:
    "That email is already on Riffle — they don't need an invite.",
  anonymous_user: "Sign in first so we know who's inviting.",
  not_authenticated: "Sign in first so we know who's inviting.",
  code_alloc_failed: "Couldn't allocate a code. Try again.",
  rate_limited:
    "Too many invites sent recently — wait a few minutes and try again, or share the link directly above.",
};

type Redemption = {
  redeemed_email: string;
  redeemed_at: string;
  reward_amount: number;
};

export default function InvitePage() {
  const { user, isAnonymous, loading } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [copied, setCopied] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (isAnonymous) router.replace("/signin");
  }, [loading, isAnonymous, router]);

  useEffect(() => {
    if (loading || isAnonymous || !user) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        // Combined endpoint: lazy-creates the invite code + returns
        // the redemption list in one round trip. Avoids the
        // sequential SECURITY DEFINER RPC that was making this page
        // cold-start for several seconds.
        const res = await fetch("/api/account/invite", {
          signal: ctrl.signal,
        });
        const json = (await res.json()) as {
          code?: string;
          redemptions?: Redemption[];
          error?: string;
        };
        if (!res.ok || json.error) {
          setLoadErr(json.error ?? "Couldn't load invite info.");
          return;
        }
        setCode(json.code ?? null);
        setRedemptions(json.redemptions ?? []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setLoadErr(e instanceof Error ? e.message : "Network error.");
      }
    })();
    return () => ctrl.abort();
  }, [loading, isAnonymous, user]);

  const inviteUrl =
    typeof window !== "undefined" && code
      ? `${window.location.origin}/?ref=${code}`
      : code
        ? `https://riffle.cc/?ref=${code}`
        : "";

  async function shareOrCopy() {
    if (!inviteUrl) return;
    const text =
      `Play Riffle with me, guess songs from half a second of audio. ` +
      `We both get ${REWARD} Riffs when you sign up: ${inviteUrl}`;
    const canNativeShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
    if (canNativeShare) {
      try {
        await navigator.share({ text, url: inviteUrl });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    const ok = await copyText(inviteUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const masked =
      local.length <= 2
        ? local[0] + "*"
        : local[0] + "*".repeat(Math.max(1, local.length - 2)) + local.slice(-1);
    return `${masked}@${domain}`;
  }

  const totalEarned = redemptions.length * REWARD;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10 text-amber-100">
      {(loading || isAnonymous) ? (
        <div className="mt-12 text-sm text-amber-100/60">Loading…</div>
      ) : (
        <div className="mt-8 w-full max-w-2xl space-y-6">
          <div>
            <h1 className="text-3xl font-black">Invite a friend</h1>
            <p className="mt-2 text-sm text-amber-100/70">
              Share your link. When a new friend signs up with their own
              email, you both get <strong>{REWARD} Riffs</strong>. One reward
              per friend, ever — to claim again, invite someone who has
              never signed up to Riffle before.
            </p>
          </div>

          {/* Share card */}
          <section className="rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Your invite link
            </p>
            {loadErr ? (
              <p className="mt-2 text-sm font-bold text-rose-700">{loadErr}</p>
            ) : !code ? (
              <p className="mt-2 text-sm text-stone-500">Generating your link…</p>
            ) : (
              <>
                <div className="mt-2 truncate rounded-xl border-2 border-stone-300 bg-stone-100 px-4 py-3 font-mono text-sm">
                  {inviteUrl}
                </div>
                <button
                  type="button"
                  onClick={shareOrCopy}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" /> Link copied
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" /> Share link
                    </>
                  )}
                </button>
              </>
            )}
          </section>

          {/* Email a friend directly */}
          <EmailInviteSection />

          {/* Stats */}
          <section className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border-4 border-stone-900 bg-stone-50 p-4 text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Friends signed up
              </p>
              <p className="mt-1 text-2xl font-black">{redemptions.length}</p>
            </div>
            <div className="rounded-2xl border-4 border-stone-900 bg-stone-50 p-4 text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Riffs earned
              </p>
              <p className="mt-1 flex items-center gap-1 text-2xl font-black">
                <Gift className="h-5 w-5 text-amber-600" /> {totalEarned}
              </p>
            </div>
          </section>

          {/* Redemption history */}
          {redemptions.length > 0 && (
            <section className="rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
              <h2 className="text-lg font-black">Your invites</h2>
              <ul className="mt-3 divide-y-2 divide-stone-200">
                {redemptions.map((r, i) => (
                  <li key={i} className="flex items-center justify-between py-2">
                    <span className="text-sm font-mono text-stone-700">
                      {maskEmail(r.redeemed_email)}
                    </span>
                    <span className="text-xs font-bold text-stone-500">
                      +{r.reward_amount} Riffs ·{" "}
                      {new Date(r.redeemed_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

// Email-an-invite section. Sibling to the link-share card so the
// player can choose whichever delivery channel they prefer. POSTs to
// /api/account/invite-friend, which uses Supabase's Invite User
// flow + the existing /?ref=CODE redirect so the invite-redemption
// pipeline stays unchanged.
function EmailInviteSection() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function send() {
    if (busy) return;
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErr(EMAIL_INVITE_ERRORS.invalid_email);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/invite-friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(EMAIL_INVITE_ERRORS[json.error ?? ""] ?? "Couldn't send invite. Try again.");
        return;
      }
      setSentTo(trimmed);
      setEmail("");
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
      <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
        Or invite by email
      </p>
      <p className="mt-1 text-sm text-stone-600">
        We&rsquo;ll send them a one-click invite. They join → you both get{" "}
        <strong>{REWARD} Riffs</strong>.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErr(null);
            setSentTo(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="friend@example.com"
          disabled={busy}
          autoComplete="email"
          className="min-w-0 flex-1 rounded-full border-4 border-stone-900 bg-stone-100 px-4 py-2 text-sm font-bold text-stone-900 focus:outline-none focus:ring-4 focus:ring-amber-300 disabled:opacity-70"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || email.trim().length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-full border-4 border-stone-900 bg-amber-400 px-5 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Mail className="h-4 w-4" /> Send invite
            </>
          )}
        </button>
      </div>
      {err && <p className="mt-2 text-xs font-bold text-rose-700">{err}</p>}
      {sentTo && !err && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
          <Check className="h-3.5 w-3.5" /> Invite sent to{" "}
          <span className="font-mono">{sentTo}</span>
        </p>
      )}
    </section>
  );
}
