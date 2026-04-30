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

  const cur = next.streak.current_streak;
  const lng = next.streak.longest_streak;
  if (cur != null && lng != null && cur > lng) {
    if (touched.includes("longest_streak")) {
      next.streak.current_streak = lng;
    } else {
      next.streak.longest_streak = cur;
    }
  }
  if (cur != null && cur < 0) next.streak.current_streak = 0;
  if (lng != null && lng < 0) next.streak.longest_streak = 0;

  if (next.streak.freezes_available != null) {
    next.streak.freezes_available = Math.max(0, Math.min(2, next.streak.freezes_available));
  }

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

  if (next.profile.coin_balance != null && next.profile.coin_balance < 0) {
    next.profile.coin_balance = 0;
  }

  if (next.profile.login_day_index != null) {
    next.profile.login_day_index = Math.max(0, Math.min(7, next.profile.login_day_index));
  }
  const today = new Date().toISOString().slice(0, 10);
  if (next.profile.login_last_claimed_on && next.profile.login_last_claimed_on > today) {
    next.profile.login_last_claimed_on = today;
  }

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

  if (next.streak.broken_at) {
    const ms = new Date(next.streak.broken_at).getTime();
    if (Number.isFinite(ms) && ms > Date.now()) {
      next.streak.broken_at = new Date().toISOString();
    }
  }

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
// Each field is a controlled input. Edits save instantly; the rest
// of the app reacts via the SIM_CHANGE_EVENT bus.
//
// Presets stored under riffle:sim:presets keyed by name.
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

  return (
    <div className="flex flex-col gap-5">
      <HeroToggle
        active={draft.active}
        noOverrides={noOverrides}
        onToggle={toggleActive}
      />

      <Section title="Profile & Daily" subtitle="Riffs · login calendar · flags">
        <NumberField
          label="Coin balance"
          unit="Riffs"
          value={draft.profile.coin_balance}
          real={realProfile?.coin_balance}
          onChange={(v) => patchProfile({ coin_balance: v })}
        />
        <NumberField
          label="Login day index"
          helper="1–7. 0 = unstarted."
          value={draft.profile.login_day_index}
          real={realProfile?.login_day_index}
          onChange={(v) => patchProfile({ login_day_index: v })}
          min={0}
          max={7}
        />
        <DateField
          label="Last claimed on"
          helper="Today = claimed today. Yesterday = ready to claim now. Blank = never claimed."
          value={draft.profile.login_last_claimed_on ?? null}
          real={realProfile?.login_last_claimed_on ?? null}
          onChange={(v) => patchProfile({ login_last_claimed_on: v })}
        />
        <BoolField
          label="Starter pack claimed"
          value={draft.profile.starter_pack_claimed}
          real={realProfile?.starter_pack_claimed}
          onChange={(v) => patchProfile({ starter_pack_claimed: v })}
        />
        <BoolField
          label="Pro active"
          helper="UI gates only — does not unlock real entitlements."
          value={draft.profile.is_pro}
          real={realProfile?.is_pro}
          onChange={(v) => patchProfile({ is_pro: v })}
        />
      </Section>

      <Section title="Streak" subtitle="Current run · freezes · restore offer">
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
          label="Freezes available"
          helper="0–2."
          value={draft.streak.freezes_available}
          real={realStreak?.freezes_available}
          onChange={(v) => patchStreak({ freezes_available: v })}
          min={0}
          max={2}
        />
        <NumberField
          label="Pre-break streak"
          helper="Used by the restore offer."
          value={draft.streak.pre_break_streak}
          real={realStreak?.pre_break_streak}
          onChange={(v) => patchStreak({ pre_break_streak: v })}
          min={0}
        />
        <DateTimeField
          label="Broken at"
          helper="Set within the last 48h to show the Restore Streak offer."
          value={draft.streak.broken_at ?? null}
          real={realStreak?.broken_at ?? null}
          onChange={(v) => patchStreak({ broken_at: v })}
        />
      </Section>

      <Section
        title="Tournament"
        subtitle="Active event score · milestones"
        note={
          <>
            Overrides apply to the currently-active event (whatever{" "}
            <code className="font-mono text-amber-200/80">get_active_event</code>{" "}
            returns). Make sure an event is seeded for the icon to render.
          </>
        }
      >
        <NumberField
          label="Your event score"
          value={draft.tournament.score}
          onChange={(v) => patchTournament({ score: v })}
          min={0}
        />
        <NumbersListField
          label="Milestones already claimed"
          helper="Comma-separated indexes (0-based). e.g. 0,1 marks the first two as claimed."
          value={draft.tournament.milestone_claims}
          onChange={(v) => patchTournament({ milestone_claims: v })}
        />
      </Section>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-700 bg-stone-900/60 px-4 py-3">
        <span className="text-[11px] text-stone-400">Edits save instantly.</span>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
        >
          Reset overlays
        </button>
      </div>

      <Section title="Presets" subtitle="Save sets of overrides for reuse">
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Name this preset"
            className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-300 focus:outline-none"
          />
          <button
            type="button"
            onClick={saveAsPreset}
            disabled={!presetName.trim()}
            className="rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-40"
          >
            Save
          </button>
        </div>
        {Object.keys(presets).length === 0 ? (
          <p className="text-[11px] text-stone-500">No presets saved yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {Object.keys(presets)
              .sort()
              .map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-2 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => loadPreset(name)}
                    className="flex-1 truncate text-left text-sm font-bold text-stone-100 hover:text-amber-200"
                  >
                    {name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete preset ${name}`}
                    onClick={() => deletePreset(name)}
                    className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300 hover:bg-rose-500/20"
                  >
                    Delete
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function HeroToggle({
  active,
  noOverrides,
  onToggle,
}: {
  active: boolean;
  noOverrides: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-4 ${
        active
          ? "border-emerald-500/60 bg-emerald-500/10"
          : "border-stone-700 bg-stone-900/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={`text-[10px] font-black uppercase tracking-[0.25em] ${
              active ? "text-emerald-300" : "text-stone-400"
            }`}
          >
            {active ? "● Live overlay" : "○ Overlay off"}
          </div>
          <div className="mt-1 text-base font-black uppercase tracking-tight text-stone-100">
            UX stage simulator
          </div>
          <p className="mt-1 text-xs text-stone-300/80">
            Layers UI state on top of the real game so you can preview every
            stage of the daily, streak, login calendar, and tournament flows.{" "}
            <span className="font-black text-stone-200">Local-only</span> —
            never writes to the database.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`shrink-0 rounded-full border-2 border-stone-900 px-4 py-2 text-[11px] font-black uppercase tracking-wider shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] ${
            active
              ? "bg-emerald-400 text-stone-900 hover:bg-emerald-300"
              : "bg-stone-200 text-stone-900 hover:bg-white"
          }`}
        >
          {active ? "Turn off" : "Turn on"}
        </button>
      </div>

      {active && noOverrides && (
        <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
          Overlay is on but no fields are set, so the UI matches the real game.
          Set any value below — it&rsquo;ll apply instantly.
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  note,
  children,
}: {
  title: string;
  subtitle?: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-700 bg-stone-900/60 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-200">
          {title}
        </h3>
        {subtitle && (
          <span className="truncate text-[10px] text-stone-500">{subtitle}</span>
        )}
      </div>
      {note && (
        <p className="mb-3 text-[11px] leading-relaxed text-stone-400">{note}</p>
      )}
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  helper,
  unit,
  real,
  children,
}: {
  label: string;
  helper?: string;
  unit?: string;
  real?: string | number | boolean | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-bold text-stone-200">
          {label}
          {unit && (
            <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wider text-stone-500">
              {unit}
            </span>
          )}
        </span>
        <RealHint value={real} />
      </div>
      {children}
      {helper && (
        <span className="text-[11px] leading-snug text-stone-500">{helper}</span>
      )}
    </label>
  );
}

function RealHint({
  value,
}: {
  value: string | number | boolean | null | undefined;
}) {
  if (value === undefined) return null;
  const display =
    value === null
      ? "—"
      : typeof value === "boolean"
        ? value
          ? "true"
          : "false"
        : String(value);
  return (
    <span className="font-mono text-[10px] text-stone-500">
      real: <span className="text-stone-300">{display}</span>
    </span>
  );
}

const inputClass =
  "w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 font-mono text-sm text-stone-100 focus:border-amber-300 focus:outline-none";

function NumberField({
  label,
  helper,
  unit,
  value,
  onChange,
  real,
  min,
  max,
}: {
  label: string;
  helper?: string;
  unit?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  real?: number | null;
  min?: number;
  max?: number;
}) {
  return (
    <FieldRow label={label} helper={helper} unit={unit} real={real ?? undefined}>
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
        className={inputClass}
      />
    </FieldRow>
  );
}

function BoolField({
  label,
  helper,
  value,
  onChange,
  real,
}: {
  label: string;
  helper?: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
  real?: boolean | null;
}) {
  const state = value === undefined ? "real" : value ? "true" : "false";
  return (
    <FieldRow label={label} helper={helper} real={real ?? undefined}>
      <select
        value={state}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "real") onChange(undefined);
          else onChange(v === "true");
        }}
        className={inputClass}
      >
        <option value="real">— Use real value</option>
        <option value="true">Force true</option>
        <option value="false">Force false</option>
      </select>
    </FieldRow>
  );
}

function DateField({
  label,
  helper,
  value,
  onChange,
  real,
}: {
  label: string;
  helper?: string;
  value: string | null | undefined;
  onChange: (v: string | null | undefined) => void;
  real?: string | null;
}) {
  return (
    <FieldRow label={label} helper={helper} real={real ?? undefined}>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={inputClass}
      />
    </FieldRow>
  );
}

function DateTimeField({
  label,
  helper,
  value,
  onChange,
  real,
}: {
  label: string;
  helper?: string;
  value: string | null | undefined;
  onChange: (v: string | null | undefined) => void;
  real?: string | null;
}) {
  const local = value ? new Date(value).toISOString().slice(0, 16) : "";
  return (
    <FieldRow label={label} helper={helper} real={real ?? undefined}>
      <input
        type="datetime-local"
        value={local}
        onChange={(e) =>
          onChange(e.target.value ? new Date(e.target.value).toISOString() : null)
        }
        className={inputClass}
      />
    </FieldRow>
  );
}

function NumbersListField({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: number[] | undefined;
  onChange: (v: number[] | undefined) => void;
}) {
  const text = value?.join(",") ?? "";
  return (
    <FieldRow label={label} helper={helper}>
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
        className={inputClass}
      />
    </FieldRow>
  );
}
