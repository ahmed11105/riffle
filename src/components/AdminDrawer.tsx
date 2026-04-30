"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, FlaskConical, RotateCcw, Music } from "lucide-react";
import { CloseButton } from "@/components/CloseButton";
import { SimulatorPanel } from "@/app/admin/SimulatorPanel";
import {
  adminHeaders,
  loadAdminConfig,
  resetClientProgress,
  resetDailyProgress,
  saveAdminConfig,
} from "@/lib/admin";

// Slide-in admin panel. Replaces the per-page pill-dropdown that
// previously held just the resets, and absorbs most of /admin (sim,
// secret editor, rollover hour, resets). The song-scheduling editor
// is too wide for a drawer; the Songs tab links out to /admin where
// the dedicated editor still lives.

type Tab = "simulator" | "resets" | "settings" | "songs";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "simulator", label: "Simulator", icon: <FlaskConical className="h-4 w-4" /> },
  { id: "resets", label: "Resets", icon: <RotateCcw className="h-4 w-4" /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon className="h-4 w-4" /> },
  { id: "songs", label: "Songs", icon: <Music className="h-4 w-4" /> },
];

export function AdminDrawer({
  open,
  onClose,
  onExit,
}: {
  open: boolean;
  onClose: () => void;
  onExit: () => void;
}) {
  const [tab, setTab] = useState<Tab>("simulator");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[110] bg-stone-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Admin tools"
        className="fixed inset-y-0 right-0 z-[111] flex w-full max-w-[600px] flex-col border-l-4 border-stone-900 bg-stone-950 text-stone-100 shadow-[-6px_0_0_0_rgba(0,0,0,0.7)]"
      >
        <header className="relative flex items-center justify-between border-b-4 border-stone-900 bg-stone-900 px-5 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">
              Admin
            </div>
            <div className="text-base font-black uppercase tracking-tight text-amber-50">
              {TABS.find((t) => t.id === tab)?.label}
            </div>
          </div>
          <CloseButton onClick={onClose} ariaLabel="Close admin tools" />
        </header>
        <nav className="flex border-b-2 border-stone-900 bg-stone-900/80">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-black uppercase tracking-wider transition ${
                  active
                    ? "bg-amber-400 text-stone-900"
                    : "text-amber-100/70 hover:bg-stone-800"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "simulator" && <SimulatorPanel />}
          {tab === "resets" && <ResetsTab onExit={onExit} onClose={onClose} />}
          {tab === "settings" && <SettingsTab />}
          {tab === "songs" && <SongsTab onClose={onClose} />}
        </div>
      </aside>
    </>
  );
}

// ============================================================
// Resets tab — daily / overall + exit admin mode
// ============================================================

function ResetsTab({
  onExit,
  onClose,
}: {
  onExit: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<"daily" | "overall" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  async function postReset(kind: "daily" | "overall") {
    return fetch("/api/admin/reset-progress", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ kind }),
    });
  }

  async function callReset(kind: "daily" | "overall") {
    setBusy(kind);
    try {
      const res = await postReset(kind);
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setToast(json.error ? `Reset failed: ${json.error}` : "Reset failed");
        return;
      }
      if (kind === "daily") {
        resetDailyProgress();
        setToast("Daily progress reset");
      } else {
        resetClientProgress();
        setToast("Overall progress reset");
      }
      window.setTimeout(() => window.location.reload(), 250);
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Reset daily">
        <p className="text-xs text-stone-300">
          Clears today&rsquo;s daily result for this account so you can play
          today&rsquo;s puzzle again. Streak / Riffs / everything else stays
          intact.
        </p>
        <button
          type="button"
          onClick={() => callReset("daily")}
          disabled={busy !== null}
          className="mt-3 rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-50"
        >
          {busy === "daily" ? "Resetting…" : "Reset daily"}
        </button>
      </Card>

      <Card title="Reset everything" tone="danger">
        <p className="text-xs text-stone-300">
          Wipes Riffs, hint inventory, login calendar, starter pack, streak
          (including freezes), all daily results, event scores, pack unlocks,
          and ad grants. Pro subscription is left alone. The page reloads.
        </p>
        {confirming ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => callReset("overall")}
              disabled={busy !== null}
              className="rounded-full border-2 border-stone-900 bg-rose-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-50 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-50"
            >
              {busy === "overall" ? "Resetting…" : "Yes, wipe it"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy !== null}
              className="rounded-full border-2 border-stone-900 bg-stone-700 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-50 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy !== null}
            className="mt-3 rounded-full border-2 border-stone-900 bg-rose-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-50 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            Reset everything…
          </button>
        )}
      </Card>

      <Card title="Exit admin mode">
        <p className="text-xs text-stone-300">
          Removes the admin border, hides the simulator banner, and stops
          showing this drawer trigger.
        </p>
        <button
          type="button"
          onClick={() => {
            onExit();
            onClose();
          }}
          className="mt-3 rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
        >
          Exit admin mode
        </button>
      </Card>

      {toast && (
        <div className="rounded-2xl border-2 border-emerald-700 bg-emerald-100 p-3 text-sm font-black text-emerald-900">
          {toast}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Settings tab — admin secret + daily rollover hour
// ============================================================

const SECRET_STORAGE_KEY = "riffle:admin:secret";

function SettingsTab() {
  return (
    <div className="flex flex-col gap-4">
      <SecretCard />
      <RolloverCard />
    </div>
  );
}

function SecretCard() {
  const [stored, setStored] = useState("");
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(SECRET_STORAGE_KEY) ?? "";
    setStored(v);
    setDraft(v);
  }, []);

  function save() {
    if (typeof window === "undefined") return;
    if (!draft) {
      window.localStorage.removeItem(SECRET_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SECRET_STORAGE_KEY, draft);
    }
    setStored(draft);
    setSavedJustNow(true);
    setTimeout(() => setSavedJustNow(false), 1800);
  }

  const dirty = draft !== stored;
  const masked = stored
    ? `${stored.slice(0, 4)}…${stored.slice(-4)} (${stored.length} chars)`
    : "Not set";

  return (
    <Card title="Admin secret">
      <p className="text-xs text-stone-300">
        Sent as <code className="font-mono">Authorization: Bearer …</code> on
        every admin write API call. Must match{" "}
        <code className="font-mono">ADMIN_SECRET</code> on Vercel. Stored only
        in this browser.
      </p>
      <div className="mt-2 text-xs font-bold text-stone-300">
        Currently saved: <span className="font-mono">{masked}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type={show ? "text" : "password"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste secret here"
          className="min-w-0 flex-1 rounded-full border-2 border-stone-900 bg-stone-50 px-4 py-2 font-mono text-sm text-stone-900"
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          className="rounded-full border-2 border-stone-900 bg-stone-100 px-3 py-2 text-xs font-black uppercase tracking-wider text-stone-900"
        >
          {show ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className="rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-50"
        >
          {savedJustNow ? "Saved ✓" : dirty ? "Save" : "Up to date"}
        </button>
      </div>
    </Card>
  );
}

function RolloverCard() {
  const [hour, setHour] = useState(0);

  useEffect(() => {
    setHour(loadAdminConfig().rolloverHourUtc);
  }, []);

  function update(h: number) {
    const next = Math.max(0, Math.min(23, h));
    setHour(next);
    const config = loadAdminConfig();
    saveAdminConfig({ ...config, rolloverHourUtc: next });
  }

  return (
    <Card title="Daily rollover (UTC hour)">
      <p className="text-xs text-stone-300">
        Shifts when the daily puzzle ticks over. Stored locally for this
        browser only — handy for testing tomorrow&rsquo;s song without waiting
        for midnight.
      </p>
      <label className="mt-3 flex items-center gap-3">
        <span className="text-xs font-black uppercase tracking-wider text-stone-300">
          Hour
        </span>
        <input
          type="number"
          min={0}
          max={23}
          value={hour}
          onChange={(e) => update(Number(e.target.value) || 0)}
          className="w-20 rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 font-mono text-stone-900"
        />
      </label>
    </Card>
  );
}

// ============================================================
// Songs tab — link to the heavier /admin scheduler
// ============================================================

function SongsTab({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Card title="Daily song scheduler">
        <p className="text-xs text-stone-300">
          The track picker, calendar, and override editor are large enough
          that they don&rsquo;t fit cleanly in this drawer. They live on the
          dedicated admin page.
        </p>
        <Link
          href="/admin"
          onClick={onClose}
          className="mt-3 inline-flex items-center gap-1 rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
        >
          Open scheduler →
        </Link>
      </Card>
    </div>
  );
}

// ============================================================
// Shared card layout for drawer sections
// ============================================================

function Card({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const skin =
    tone === "danger"
      ? "border-rose-700 bg-rose-950/40"
      : "border-stone-700 bg-stone-900";
  return (
    <div className={`rounded-2xl border-2 p-4 ${skin}`}>
      <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-amber-200/70">
        {title}
      </div>
      {children}
    </div>
  );
}
