"use client";

import { useEffect, useState } from "react";
// (useState is kept, useAdminMode uses it below.)

// Lightweight client-side admin flag. Flipped on by a secret gesture
// (rapid-tapping the logo 7 times in a row) so internal testing tools can
// appear without shipping a dedicated login flow. The flag is stored in
// localStorage under `riffle:admin` and survives refresh.

const KEY = "riffle:admin";
const SECRET_KEY = "riffle:admin:secret";

export function isAdmin(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function setAdmin(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) {
    // Prompt for the admin secret on first activation.
    const existing = window.localStorage.getItem(SECRET_KEY);
    if (!existing) {
      const secret = window.prompt("Enter admin secret:");
      if (!secret) return;
      window.localStorage.setItem(SECRET_KEY, secret);
    }
    window.localStorage.setItem(KEY, "1");
  } else {
    window.localStorage.removeItem(KEY);
  }
  window.dispatchEvent(new CustomEvent("riffle:admin-change"));
}

export function getAdminSecret(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SECRET_KEY);
}

// Builds headers with admin auth for fetch calls to protected API routes.
export function adminHeaders(): Record<string, string> {
  const secret = getAdminSecret();
  if (!secret) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
}

export function useAdminMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(isAdmin());
    const handler = () => setOn(isAdmin());
    window.addEventListener("riffle:admin-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("riffle:admin-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return [on, setAdmin];
}

// Rapid-tap gesture: returns an onClick you can attach to any element
// (we use the Logo). Seven taps within 2 seconds toggles admin mode.
//
// The tap counter lives in localStorage instead of React state because the
// Logo is often wrapped in a Next <Link>, so every click triggers client
// navigation that tears down component state, without persistence the
// count would reset to 1 on every tap. On the 7th tap we vibrate (where
// supported) as a confirmation cue.
const TAP_KEY = "riffle:admin:taps";
const TAP_WINDOW_MS = 2000;
const TAP_THRESHOLD = 7;
export function useAdminTapGesture(): () => void {
  return () => {
    if (typeof window === "undefined") return;
    const now = Date.now();
    let count = 0;
    let first = 0;
    try {
      const raw = window.localStorage.getItem(TAP_KEY);
      if (raw) ({ count, first } = JSON.parse(raw));
    } catch {}
    const fresh = now - first > TAP_WINDOW_MS;
    const nextCount = fresh ? 1 : count + 1;
    const nextFirst = fresh ? now : first;
    if (nextCount >= TAP_THRESHOLD) {
      setAdmin(!isAdmin());
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          (navigator as Navigator & { vibrate: (p: number[] | number) => void }).vibrate([
            30, 30, 60,
          ]);
        } catch {}
      }
      window.localStorage.removeItem(TAP_KEY);
      return;
    }
    window.localStorage.setItem(
      TAP_KEY,
      JSON.stringify({ count: nextCount, first: nextFirst }),
    );
  };
}

// Keyboard listener that flips admin mode when the user types a secret
// word anywhere outside an input. Uses a rolling buffer so partial typos
// don't block the trigger. Mount this once at the app root.
const SECRET = "riffleadmin";
export function useAdminKeySequence() {
  useEffect(() => {
    let buffer = "";
    function onKey(e: KeyboardEvent) {
      // Ignore keystrokes while typing into form fields so we don't clash
      // with the guess input, lobby config, etc.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (e.key.length !== 1) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-SECRET.length);
      if (buffer === SECRET) {
        setAdmin(!isAdmin());
        buffer = "";
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// Device-local admin config. These settings only affect the current
// browser, they're useful for previewing upcoming dailies, overriding
// the day's track for testing, and shifting the rollover hour without
// editing server code.
// Track data stored in overrides, same shape as PoolTrack so the daily
// page can render it directly without a pool lookup. This lets admins pin
// songs that aren't in the static pool (e.g. searched live from iTunes).
export type OverrideTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  previewUrl: string;
  durationMs: number;
  releaseYear: number | null;
};
export type AdminConfig = {
  rolloverHourUtc: number;
  overrides: Record<string, OverrideTrack>; // dayKey → full track data
};
const CONFIG_KEY = "riffle:admin:config";
const DEFAULT_CONFIG: AdminConfig = { rolloverHourUtc: 0, overrides: {} };
export function loadAdminConfig(): AdminConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AdminConfig>;
    return {
      rolloverHourUtc:
        typeof parsed.rolloverHourUtc === "number" ? parsed.rolloverHourUtc : 0,
      overrides: parsed.overrides ?? {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
export function saveAdminConfig(cfg: AdminConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent("riffle:admin-config-change"));
  } catch {}
}

// Nuke the stored daily progress for the current user so you can replay
// today's song without waiting for the rollover. Called from the admin
// overlay on the daily page.
export function resetDailyProgress() {
  if (typeof window === "undefined") return;
  const remove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (key.startsWith("riffle:daily:done:") || key.startsWith("riffle:daily:session:")) {
      remove.push(key);
    }
  }
  for (const k of remove) window.localStorage.removeItem(k);
  window.dispatchEvent(new CustomEvent("riffle:daily-reset"));
}
