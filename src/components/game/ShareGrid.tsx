"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

const TOTAL_LEVELS = 5;

type GuessKind = "correct" | "wrong" | "skipped";

function emojiForKind(kind: GuessKind | null): string {
  if (kind === "correct") return "🟩";
  if (kind === "wrong") return "🟧";
  if (kind === "skipped") return "⬜";
  return "⬛";
}

function buildShareText(date: string, guesses: GuessKind[], correct: boolean) {
  const padded: (GuessKind | null)[] = Array.from({ length: TOTAL_LEVELS }, (_, i) =>
    guesses[i] ?? null,
  );
  const grid = padded.map(emojiForKind).join("");
  const result = correct ? `solved in ${guesses.length}` : "missed";
  return `Riffle · ${date}\n${grid}  (${result})\n\nhttps://riffle.cc`;
}

export function ShareGrid({
  date,
  guesses,
  correct,
}: {
  date: string;
  guesses: GuessKind[];
  correct: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareText = buildShareText(date, guesses, correct);

  async function share() {
    setError(null);
    // Native share sheet on mobile, clipboard everywhere else.
    const canNativeShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
    if (canNativeShare) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch (e) {
        // User cancelled or share failed; fall through to clipboard.
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy. Long-press the result above to copy manually.");
    }
  }

  const padded: (GuessKind | null)[] = Array.from({ length: TOTAL_LEVELS }, (_, i) =>
    guesses[i] ?? null,
  );

  return (
    <div className="w-full rounded-2xl border-4 border-stone-900 bg-stone-50 p-4 text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Your result
        </p>
        <p className="text-xs font-bold text-stone-400">{date}</p>
      </div>
      <div className="mt-2 flex justify-center gap-1.5 text-2xl leading-none select-all">
        {padded.map((kind, i) => (
          <span key={i} aria-label={kind ?? "not reached"}>
            {emojiForKind(kind)}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={share}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border-4 border-stone-900 bg-amber-400 px-5 py-2.5 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" /> Copied!
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" /> Share result
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs font-bold text-rose-700">{error}</p>
      )}
    </div>
  );
}
