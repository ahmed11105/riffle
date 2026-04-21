"use client";

import { useState } from "react";

const SUPPORT_EMAIL = "support@riffle.cc";

export function ContactClient() {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (rare). Fall back to selecting the email text.
      const range = document.createRange();
      const node = document.getElementById("support-email-text");
      if (node) {
        range.selectNode(node);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  }

  return (
    <div className="mt-6 rounded-2xl border-4 border-stone-900 bg-amber-400 p-5 text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]">
      <div className="text-xs font-bold uppercase tracking-wider">
        Email us
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div id="support-email-text" className="text-2xl font-black">
          {SUPPORT_EMAIL}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyEmail}
            className="rounded-full border-2 border-stone-900 bg-stone-50 px-4 py-2 text-xs font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="rounded-full border-4 border-stone-900 bg-stone-900 px-4 py-2 text-xs font-black text-amber-300 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
          >
            Open in mail app
          </a>
        </div>
      </div>
    </div>
  );
}
