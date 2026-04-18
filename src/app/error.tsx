"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Riffle route error:", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-amber-100">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border-4 border-stone-900 bg-stone-50 p-8 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Something broke
          </div>
          <h1 className="mt-2 text-3xl font-black">That riff fell flat.</h1>
          <p className="mt-3 text-sm text-stone-600">
            We couldn&rsquo;t load this page. Try again, or head back to the lobby.
          </p>
          {error.digest && (
            <p className="mt-4 font-mono text-[10px] text-stone-400">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="flex-1 rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-sm font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="flex-1 rounded-full border-4 border-stone-900 bg-stone-100 px-6 py-3 text-center text-sm font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
