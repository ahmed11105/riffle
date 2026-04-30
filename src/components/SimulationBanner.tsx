"use client";

import Link from "next/link";
import { useSimulation, clearSim } from "@/lib/simulation";

// Tiny global indicator that appears whenever the simulator overlay
// is active. Sits below the page chrome ribbon. Reminds the player
// (us) that what they're seeing isn't real game state, with a one-
// click "Stop simulating" escape hatch and a link to the panel.
export function SimulationBanner() {
  const sim = useSimulation();
  if (!sim.active) return null;

  return (
    <div className="border-y-2 border-emerald-600 bg-emerald-500/15 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-6 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-200">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Simulator overlay active — UI shows fake state, real game untouched
        </span>
        <span className="flex items-center gap-2">
          <Link href="/admin" className="underline-offset-2 hover:underline">
            Edit on /admin
          </Link>
          <button
            type="button"
            onClick={clearSim}
            className="rounded-full border border-emerald-400 px-2 py-0.5 hover:bg-emerald-500/30"
          >
            Stop
          </button>
        </span>
      </div>
    </div>
  );
}
