"use client";

import { useEffect, useState } from "react";

// Client-side simulation overlay. When enabled (admin mode + an
// active sim) the AuthProvider merges these values on top of the
// real profile/streak data, and the daily / tournament managers
// short-circuit their server writes so claims don't actually hit
// the database. Real game state stays untouched — this lives
// entirely in localStorage and in-memory React state.

const KEY = "riffle:sim:state";
const PRESETS_KEY = "riffle:sim:presets";

export const SIM_CHANGE_EVENT = "riffle:sim-change";

export type SimProfile = {
  coin_balance?: number;
  login_day_index?: number;
  login_last_claimed_on?: string | null;
  starter_pack_claimed?: boolean;
  is_pro?: boolean;
};

export type SimStreak = {
  current_streak?: number;
  longest_streak?: number;
  freezes_available?: number;
  broken_at?: string | null;
  pre_break_streak?: number;
};

export type SimTournament = {
  score?: number;
  milestone_claims?: number[];
};

export type SimulationState = {
  active: boolean;
  profile: SimProfile;
  streak: SimStreak;
  tournament: SimTournament;
};

export const EMPTY_SIM: SimulationState = {
  active: false,
  profile: {},
  streak: {},
  tournament: {},
};

export type SimPresets = Record<string, SimulationState>;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadSim(): SimulationState {
  if (typeof window === "undefined") return EMPTY_SIM;
  return safeParse<SimulationState>(window.localStorage.getItem(KEY), EMPTY_SIM);
}

export function saveSim(state: SimulationState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(SIM_CHANGE_EVENT));
}

export function clearSim() {
  saveSim(EMPTY_SIM);
}

export function loadPresets(): SimPresets {
  if (typeof window === "undefined") return {};
  return safeParse<SimPresets>(window.localStorage.getItem(PRESETS_KEY), {});
}

export function savePresets(presets: SimPresets) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  window.dispatchEvent(new CustomEvent(SIM_CHANGE_EVENT));
}

// React hook returning the live sim state. Re-renders subscribers on
// any sim-change event (panel save / preset load / clear).
export function useSimulation(): SimulationState {
  const [state, setState] = useState<SimulationState>(EMPTY_SIM);
  useEffect(() => {
    setState(loadSim());
    function handle() {
      setState(loadSim());
    }
    window.addEventListener(SIM_CHANGE_EVENT, handle);
    window.addEventListener("storage", handle);
    return () => {
      window.removeEventListener(SIM_CHANGE_EVENT, handle);
      window.removeEventListener("storage", handle);
    };
  }, []);
  return state;
}

// Generic shallow merge — only overrides keys that are present in
// the overlay. Undefined values pass through to the real value.
function applyOverlay<T extends Record<string, unknown>>(real: T, overlay: Partial<T>): T {
  const result: Record<string, unknown> = { ...real };
  for (const [k, v] of Object.entries(overlay)) {
    if (v !== undefined) result[k] = v;
  }
  return result as T;
}

export function applyProfileOverlay<T extends Record<string, unknown>>(
  real: T | null,
  sim: SimulationState,
): T | null {
  if (!real || !sim.active) return real;
  return applyOverlay(real, sim.profile as Partial<T>);
}

export function applyStreakOverlay<T extends Record<string, unknown>>(
  real: T | null,
  sim: SimulationState,
): T | null {
  if (!real || !sim.active) return real;
  return applyOverlay(real, sim.streak as Partial<T>);
}

export function applyTournamentEntryOverlay<
  T extends { score?: number; milestone_claims?: number[] },
>(real: T | null, sim: SimulationState): T | null {
  if (!sim.active) return real;
  const base =
    real ?? ({ score: 0, milestone_claims: [] as number[] } as unknown as T);
  return applyOverlay(base, sim.tournament as Partial<T>);
}
