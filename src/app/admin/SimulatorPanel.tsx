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
  const [draft, setDraft] = useState<SimulationState>(EMPTY_SIM);
  const [presets, setPresets] = useState<Record<string, SimulationState>>({});
  const [presetName, setPresetName] = useState("");
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    setDraft(loadSim());
    setPresets(loadPresets());
  }, []);

  function persist(next: SimulationState) {
    setDraft(next);
    saveSim(next);
    setSavedTick((t) => t + 1);
    setTimeout(() => setSavedTick((t) => t), 0);
  }

  function patchProfile(p: Partial<SimulationState["profile"]>) {
    persist({ ...draft, profile: { ...draft.profile, ...p } });
  }
  function patchStreak(p: Partial<SimulationState["streak"]>) {
    persist({ ...draft, streak: { ...draft.streak, ...p } });
  }
  function patchTournament(p: Partial<SimulationState["tournament"]>) {
    persist({ ...draft, tournament: { ...draft.tournament, ...p } });
  }

  function toggleActive() {
    persist({ ...draft, active: !draft.active });
  }

  function clearAll() {
    persist(EMPTY_SIM);
  }

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

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {/* Profile / Riffs / Login calendar */}
        <Section title="Profile & Daily Calendar">
          <NumberField
            label="Coin balance (Riffs)"
            value={draft.profile.coin_balance}
            onChange={(v) => patchProfile({ coin_balance: v })}
          />
          <NumberField
            label="Login day index (1–7, 0 = unstarted)"
            value={draft.profile.login_day_index}
            onChange={(v) => patchProfile({ login_day_index: v })}
            min={0}
            max={7}
          />
          <DateField
            label="Last claimed on (UTC date)"
            value={draft.profile.login_last_claimed_on ?? null}
            onChange={(v) => patchProfile({ login_last_claimed_on: v })}
            helper="Set to today's UTC date to mark today as claimed. Leave blank to mark not yet claimed."
          />
          <BoolField
            label="Starter pack claimed"
            value={draft.profile.starter_pack_claimed}
            onChange={(v) => patchProfile({ starter_pack_claimed: v })}
          />
          <BoolField
            label="Pro active (UI gates only)"
            value={draft.profile.is_pro}
            onChange={(v) => patchProfile({ is_pro: v })}
          />
        </Section>

        {/* Streak */}
        <Section title="Streak">
          <NumberField
            label="Current streak"
            value={draft.streak.current_streak}
            onChange={(v) => patchStreak({ current_streak: v })}
            min={0}
          />
          <NumberField
            label="Longest streak"
            value={draft.streak.longest_streak}
            onChange={(v) => patchStreak({ longest_streak: v })}
            min={0}
          />
          <NumberField
            label="Freezes available (0–2)"
            value={draft.streak.freezes_available}
            onChange={(v) => patchStreak({ freezes_available: v })}
            min={0}
            max={2}
          />
          <NumberField
            label="Pre-break streak (for restore offer)"
            value={draft.streak.pre_break_streak}
            onChange={(v) => patchStreak({ pre_break_streak: v })}
            min={0}
          />
          <DateTimeField
            label="Broken at (ISO timestamp)"
            value={draft.streak.broken_at ?? null}
            onChange={(v) => patchStreak({ broken_at: v })}
            helper="Set within the last 48h to show the Restore Streak offer."
          />
        </Section>

        {/* Tournament */}
        <Section title="Tournament" wide>
          <p className="mb-2 text-xs text-stone-600">
            Overrides apply to the currently-active event (whichever one
            <code className="ml-1 font-mono">get_active_event</code>
            returns). Make sure an event is seeded in the DB for the icon
            to render.
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
          {savedTick > 0 ? "Saved · live" : "Edits save instantly"}
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

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
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
    </label>
  );
}

function BoolField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  // Three-state: real (undefined), forced true, forced false
  const state = value === undefined ? "real" : value ? "true" : "false";
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
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
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null | undefined) => void;
  helper?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="text-stone-700">{label}</span>
        <input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 font-mono text-sm"
        />
      </span>
      {helper && <span className="text-[11px] text-stone-500">{helper}</span>}
    </label>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null | undefined) => void;
  helper?: string;
}) {
  // Convert ISO string ↔ datetime-local format
  const local = value ? new Date(value).toISOString().slice(0, 16) : "";
  return (
    <label className="flex flex-col gap-1 text-sm">
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
