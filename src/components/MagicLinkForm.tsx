"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAnalytics } from "@/lib/analytics/AnalyticsProvider";
import { EVENTS } from "@/lib/analytics/events";

type Status = "idle" | "sending" | "sent" | "error";

// Reused on /shop and /account so the upgrade-from-anonymous flow is
// identical everywhere. Age attestation is required (UK GDPR / COPPA).
export function MagicLinkForm() {
  const { signInWithEmail } = useAuth();
  const { track } = useAnalytics();
  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [ageOk, setAgeOk] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  async function send() {
    setEmailMsg(null);
    if (!email.includes("@")) {
      setEmailMsg("Enter a valid email.");
      return;
    }
    if (!ageOk) {
      setEmailMsg("Please confirm you're 13 or older.");
      return;
    }
    track(EVENTS.SIGNUP_STARTED, { method: "magic_link" });
    setStatus("sending");
    const { error } = await signInWithEmail(email);
    if (error) {
      setStatus("error");
      setEmailMsg(error);
    } else {
      setStatus("sent");
      setEmailMsg("Check your email for a magic link.");
    }
  }

  // Reset the button back to "Send link" if the user changes the address
  // after sending, so a typo can be retried without a page refresh.
  function onEmailChange(value: string) {
    setEmail(value);
    if (status === "sent" || status === "error") {
      setStatus("idle");
      setEmailMsg(null);
    }
  }

  const buttonDisabled = status === "sending" || status === "sent";
  const buttonLabel =
    status === "sending" ? "Sending…" : status === "sent" ? "Sent" : "Send link";
  const buttonClass =
    status === "sent"
      ? "rounded-full border-4 border-stone-900 bg-stone-200 px-6 py-2 text-sm font-black text-stone-500 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] cursor-not-allowed inline-flex items-center justify-center gap-1.5"
      : "rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className="flex-1 rounded-full border-4 border-stone-900 bg-white px-4 py-2 text-stone-900 placeholder:text-stone-400"
        />
        <button
          type="button"
          onClick={send}
          disabled={buttonDisabled}
          className={buttonClass}
        >
          {status === "sent" && <Check className="h-3.5 w-3.5" />}
          {buttonLabel}
        </button>
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-stone-600">
        <input
          type="checkbox"
          checked={ageOk}
          onChange={(e) => setAgeOk(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-amber-500"
        />
        <span>
          I confirm I&rsquo;m at least 13 years old (16 in the EU/UK) and
          accept the{" "}
          <Link href="/terms" className="font-bold text-amber-700 underline">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-bold text-amber-700 underline">
            privacy policy
          </Link>
          .
        </span>
      </label>
      {emailMsg && (
        <p className="mt-2 text-sm font-bold text-stone-700">{emailMsg}</p>
      )}
    </div>
  );
}
