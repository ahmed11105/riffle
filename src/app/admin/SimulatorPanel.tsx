"use client";

import { useEffect, useState } from "react";
import {
  EMPTY_SIM,
  loadPresets,
  loadSim,
  saveSim,
  savePresets,
  type SimulationState,
} from "@/lib/simulation";
import { useAuth } from "@/lib/auth/AuthProvider";

// Auto-correct math invariants. Any time a field is patched, look
// at the resulting combined draft and adjust dependent values so
// nothing contradicts. The KEY rule the user gave: prioritize the
// thing they just typed, change the others to match.
//
// `touched` lists the keys that came from the latest patch — for
// rules like "current vs longest", we know which one to keep
// (the touched one) and which one to adjust.
function reconcile(state: SimulationState, touched: string[]): SimulationState {
  const next: SimulationState = {
    active: state.active,
    profile: { ...state.profile },
    streak: { ...state.streak },
    tournament: { ...state.tournament },
  };

  // Streak: longest_streak >= current_streak. Whichever was typed
  // last wins; the other gets bumped to match.
  const cur = next.streak.current_streak;
  const lng = next.streak.longest_streak;
  if (cur != null && lng != null && cur > lng) {
    if (touched.includes("longest_streak")) {
      next.streak.current_streak = lng; // user lowered longest, current follows
    } else {
      next.streak.longest_streak = cur; // user raised current, longest follows
    }
  }
  if (cur != null && cur < 0) next.streak.current_streak = 0;
  if (lng != null && lng < 0) next.streak.longest_streak = 0;

  // Freezes always 0..2.
  if (next.streak.freezes_available != null) {
    next.streak.freezes_available = Math.max(0, Math.min(2, next.streak.freezes_available));
  }

  // pre_break_streak only meaningful with broken_at. If user sets
  // pre_break_streak but no broken_at, default broken_at to "now"
  // so the restore offer can render. If they set broken_at but no
  // pre_break_streak, default pre_break_streak to 3 (the restore
  // offer's threshold).
  if (next.streak.pre_break_streak != null && next.streak.pre_break_streak > 0 && !next.streak.broken_at) {
    if (!touched.includes("broken_at")) {
      next.streak.broken_at = new Date().toISOString();
    }
  }
  if (next.streak.broken_at && (next.streak.pre_break_streak == null || next.streak.pre_break_streak < 3)) {
    if (!touched.includes("pre_break_streak")) {
      next.streak.pre_break_streak = 3;
    }
  }

  // Coin balance non-negative.
  if (next.profile.coin_balance != null && next.profile.coin_balance < 0) {
    next.profile.coin_balance = 0;
  }

  // Login day index 0..7. login_last_claimed_on can't be in the future.
  if (next.profile.login_day_index != null) {
    next.profile.login_day_index = Math.max(0, Math.min(7, next.profile.login_day_index));
  }
  const today = new Date().toISOString().slice(0, 10);
  if (next.profile.login_last_claimed_on && next.profile.login_last_claimed_on > today) {
    next.profile.login_last_claimed_on = today;
  }

  // last_claimed implies day index >= 1. day index >= 1 implies
  // last_claimed exists (so we don't show day-N-ready when there
  // was no prior claim recorded).
  if (next.profile.login_last_claimed_on && (next.profile.login_day_index ?? 0) < 1) {
    if (!touched.includes("login_day_index")) {
      next.profile.login_day_index = 1;
    }
  }
  if ((next.profile.login_day_index ?? 0) >= 1 && !next.profile.login_last_claimed_on) {
    if (!touched.includes("login_last_claimed_on")) {
      next.profile.login_last_claimed_on = today;
    }
  }

  // broken_at can't be in the future either.
  if (next.streak.broken_at) {
    const ms = new Date(next.streak.broken_at).getTime();
    if (Number.isFinite(ms) && ms > Date.now()) {
      next.streak.broken_at = new Date().toISOString();
    }
  }

  // Tournament score non-negative; milestone_claims must be unique.
  if (next.tournament.score != null && next.tournament.score < 0) {
    next.tournament.score = 0;
  }
  if (next.tournament.milestone_claims) {
    next.tournament.milestone_claims = Array.from(new Set(next.tournament.milestone_claims))
      .filter((n) => n >= 0)
      .sort((a, b) => a - b);
  }

  return next;
}

// Admin simulator. Edits a localStorage-only sim state that
// AuthProvider + Tournament/Daily managers overlay on top of real
// data. The real DB is never written by anything in this panel.
//
// Each field is a controlled input. "Apply" persists; the rest of
// the app reacts via the SIM_CHANGE_EVENT bus.
//
// Presets stored under riffle:sim:presets keyed by name. Save the
// current values, switch between named profiles, delete when done.
export function SimulatorPanel() {
  const { profile: realProfile, streak: realStreak } = useAuth();
  const [draft, setDraft] = useState<SimulationState>(EMPTY_SIM);
  const [presets, setPresets] = useState<Record<string, SimulationState>>({});
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    setDraft(loadSim());
    setPresets(loadPresets());
  }, []);

  function persist(next: SimulationState) {
    setDraft(next);
    saveSim(next);
  }

  function patchProfile(p: Partial<SimulationState["profile"]>) {
    const next = { ...draft, profile: { ...draft.profile, ...p } };
    persist(reconcile(next, Object.keys(p)));
  }
  function patchStreak(p: Partial<SimulationState["streak"]>) {
    const next = { ...draft, streak: { ...draft.streak, ...p } };
    persist(reconcile(next, Object.keys(p)));
  }
  function patchTournament(p: Partial<SimulationState["tournament"]>) {
    const next = { ...draft, tournament: { ...draft.tournament, ...p } };
    persist(reconcile(next, Object.keys(p)));
  }

  function toggleActive() {
    persist({ ...draft, active: !draft.active });
  }

  function clearAll() {
    persist(EMPTY_SIM);
  }

  // Empty if no overrides are set under any section. Used to show a
  // helpful "you haven't set anything yet" hint when sim is ON.
  const noOverrides =
    Object.keys(draft.profile).length === 0 &&
    Object.keys(draft.streak).length === 0 &&
    Object.keys(draft.tournament).length === 0;

  function saveAsPreset() {
    const name = presetName.trim();
    if (!name) return;
    const next = { ...presets, [name]: draft };
    setPresets(next);
    savePresets(next);
    setPresetName("");
  }

  function loadPreset(name: string) {
    const p = presets[name];
    if (!p) return;
    persist(p);
  }

  function deletePreset(name: string) {
    const next = { ...presets };
    delete next[name];
    setPresets(next);
    savePresets(next);
  }

  const activeBg = draft.active
    ? "border-emerald-700 bg-emerald-50"
    : "border-stone-300 bg-stone-50";

  return (
    <div className={`rounded-3xl border-4 p-5 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)] ${activeBg}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-stone-500">
            Simulator
          </div>
          <h2 className="text-lg font-black uppercase tracking-tight">
            UX stage simulator
          </h2>
          <p className="mt-1 text-xs text-stone-600">
            Overlays UI state for testing the daily / tournament / icon flows
            at any stage. <span className="font-black">Local-only</span> — does
            not touch the database, does not change the real game.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleActive}
          className={`shrink-0 rounded-full border-2 border-stone-900 px-4 py-2 text-xs font-black uppercase tracking-wider shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] ${
            draft.active ? "bg-emerald-400 text-stone-900" : "bg-stone-200 text-stone-700"
          }`}
        >
          {draft.active ? "Simulating · ON" : "Simulating · OFF"}
        </button>
      </div>

      {draft.active && noOverrides && (
        <div className="mt-4 rounded-2xl border-2 border-amber-700 bg-amber-100 p-3 text-sm text-amber-900">
          <span className="font-black uppercase tracking-wider">Tip:</span> the
          overlay is on but no fields are set, so the UI looks identical to the
          real game. Set any value below — it&rsquo;ll apply instantly.
        </div>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {/* Profile / Riffs / Login calendar */}
        <Section title="Profile & Daily Calendar">
          <NumberField
            label="Coin balance (Riffs)"
            value={draft.profile.coin_balance}
            real={realProfile?.coin_balance}
            onChange={(v) => patchProfile({ coin_balance: v })}
          />
          <NumberField
            label="Login day index (1–7, 0 = unstarted)"
            value={draft.profile.login_day_index}
            real={realProfile?.login_day_index}
            onChange={(v) => patchProfile({ login_day_index: v })}
            min={0}
            max={7}
          />
          <DateField
            label="Last claimed on (UTC date)"
            value={draft.profile.login_last_claimed_on ?? null}
            real={realProfile?.login_last_claimed_on ?? null}
            onChange={(v) => patchProfile({ login_last_claimed_on: v })}
            helper="Today = claimed today. Yesterday = ready to claim now. Blank = never claimed."
          />
          <BoolField
            label="Starter pack claimed"
            value={draft.profile.starter_pack_claimed}
            real={realProfile?.starter_pack_claimed}
            onChange={(v) => patchProfile({ starter_pack_claimed: v })}
          />
          <BoolField
            label="Pro active (UI gates only)"
            value={draft.profile.is_pro}
            real={realProfile?.is_pro}
            onChange={(v) => patchProfile({ is_pro: v })}
          />
        </Section>

        {/* Streak */}
        <Section title="Streak">
          <NumberField
            label="Current streak"
            value={draft.streak.current_streak}
            real={realStreak?.current_streak}
            onChange={(v) => patchStreak({ current_streak: v })}
            min={0}
          />
          <NumberField
            label="Longest streak"
            value={draft.streak.longest_streak}
            real={realStreak?.longest_streak}
            onChange={(v) => patchStreak({ longest_streak: v })}
            min={0}
          />
          <NumberField
            label="Freezes available (0–2)"
            value={draft.streak.freezes_available}
            real={realStreak?.freezes_available}
            onChange={(v) => patchStreak({ freezes_available: v })}
            min={0}
            max={2}
          />
          <NumberField
            label="Pre-break streak (for restore offer)"
            value={draft.streak.pre_break_streak}
            real={realStreak?.pre_break_streak}
            onChange={(v) => patchStreak({ pre_break_streak: v })}
            min={0}
          />
          <DateTimeField
            label="Broken at"
            value={draft.streak.broken_at ?? null}
            real={realStreak?.broken_at ?? null}
            onChange={(v) => patchStreak({ broken_at: v })}
            helper="Set within the last 48h to show the Restore Streak offer."
          />
        </Section>

        {/* Tournament */}
        <Section title="Tournament" wide>
          <p className="mb-2 text-xs text-stone-600">
            Overrides apply to the currently-active event (whichever one{" "}
            <code className="font-mono">get_active_event</code> returns). Make
            sure an event is seeded in the DB for the icon to render.
          </p>
          <NumberField
            label="Your event score"
            value={draft.tournament.score}
            onChange={(v) => patchTournament({ score: v })}
            min={0}
          />
          <NumbersListField
            label="Milestones already claimed (indexes, comma-separated)"
            value={draft.tournament.milestone_claims}
            onChange={(v) => patchTournament({ milestone_claims: v })}
            helper="e.g. '0,1' marks the first two as claimed. Indexes start at 0."
          />
        </Section>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={clearAll}
          className="rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
        >
          Reset all overlays
        </button>
        <span className="text-xs font-bold text-stone-500">
          Edits save instantly
        </span>
      </div>

      {/* Presets */}
      <div className="mt-5 rounded-2xl border-2 border-stone-900 bg-stone-50 p-4">
        <div className="text-xs font-black uppercase tracking-wider text-stone-500">
          Presets
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Name this preset"
            className="min-w-0 flex-1 rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={saveAsPreset}
            disabled={!presetName.trim()}
            className="rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-50"
          >
            Save current
          </button>
        </div>
        {Object.keys(presets).length === 0 ? (
          <p className="mt-3 text-xs text-stone-500">No presets saved yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {Object.keys(presets)
              .sort()
              .map((name) => (
                <li key={name} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => loadPreset(name)}
                    className="rounded-full border-2 border-stone-900 bg-stone-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_1px_0_0_rgba(0,0,0,0.9)] hover:bg-stone-200"
                  >
                    {name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete preset ${name}`}
                    onClick={() => deletePreset(name)}
                    className="rounded-full border-2 border-stone-900 bg-rose-200 px-2 py-1 text-[10px] font-black text-rose-900 shadow-[0_1px_0_0_rgba(0,0,0,0.9)] hover:bg-rose-300"
                  >
                    ×
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl border-2 border-stone-900 bg-stone-50 p-4 ${wide ? "md:col-span-2" : ""}`}>
      <div className="mb-3 text-xs font-black uppercase tracking-wider text-stone-500">
        {title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function RealHint({ value }: { value: string | number | boolean | null | undefined }) {
  if (value === undefined) return null;
  const display =
    value === null
      ? "(none)"
      : typeof value === "boolean"
        ? value
          ? "true"
          : "false"
        : String(value);
  return (
    <span className="text-[10px] font-mono text-stone-400">
      Real: {display}
    </span>
  );
}

function NumberField({
  label,
  value,
  onChange,
  real,
  min,
  max,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  real?: number | null;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="text-stone-700">{label}</span>
        <input
          type="number"
          value={value ?? ""}
          min={min}
          max={max}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") onChange(undefined);
            else onChange(Number(raw));
          }}
          className="w-24 rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 font-mono text-right text-sm"
        />
      </span>
      <RealHint value={real ?? undefined} />
    </label>
  );
}

function BoolField({
  label,
  value,
  onChange,
  real,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
  real?: boolean | null;
}) {
  const state = value === undefined ? "real" : value ? "true" : "false";
  return (
    <label className="flex flex-col gap-0.5 text-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="text-stone-700">{label}</span>
        <select
          value={state}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "real") onChange(undefined);
            else onChange(v === "true");
          }}
          className="rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 text-sm"
        >
          <option value="real">— (use real)</option>
          <option value="true">Force true</option>
          <option value="false">Force false</option>
        </select>
      </span>
      <RealHint value={real ?? undefined} />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  helper,
  real,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null | undefined) => void;
  helper?: string;
  real?: string | null;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="text-stone-700">{label}</span>
        <input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 font-mono text-sm"
        />
      </span>
      <RealHint value={real ?? undefined} />
      {helper && <span className="text-[11px] text-stone-500">{helper}</span>}
    </label>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
  helper,
  real,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null | undefined) => void;
  helper?: string;
  real?: string | null;
}) {
  const local = value ? new Date(value).toISOString().slice(0, 16) : "";
  return (
    <label className="flex flex-col gap-0.5 text-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="text-stone-700">{label}</span>
        <input
          type="datetime-local"
          value={local}
          onChange={(e) =>
            onChange(e.target.value ? new Date(e.target.value).toISOString() : null)
          }
          className="rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 font-mono text-sm"
        />
      </span>
      <RealHint value={real ?? undefined} />
      {helper && <span className="text-[11px] text-stone-500">{helper}</span>}
    </label>
  );
}

function NumbersListField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: number[] | undefined;
  onChange: (v: number[] | undefined) => void;
  helper?: string;
}) {
  const text = value?.join(",") ?? "";
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="text-stone-700">{label}</span>
        <input
          type="text"
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw.trim()) {
              onChange(undefined);
              return;
            }
            const nums = raw
              .split(",")
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isFinite(n));
            onChange(nums);
          }}
          placeholder="0,1,2"
          className="w-32 rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 font-mono text-sm"
        />
      </span>
      {helper && <span className="text-[11px] text-stone-500">{helper}</span>}
    </label>
  );
}
