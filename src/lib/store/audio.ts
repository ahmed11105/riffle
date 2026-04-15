"use client";

import { create } from "zustand";

type AudioState = {
  volume: number; // 0..1
  muted: boolean;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  effectiveVolume: () => number;
};

const STORAGE_KEY = "riffle:volume";

function readInitial(): { volume: number; muted: boolean } {
  if (typeof window === "undefined") return { volume: 0.7, muted: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { volume: 0.7, muted: false };
    const parsed = JSON.parse(raw) as { volume?: number; muted?: boolean };
    return {
      volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(1, parsed.volume)) : 0.7,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return { volume: 0.7, muted: false };
  }
}

function persist(state: { volume: number; muted: boolean }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

const initial = readInitial();

export const useAudioStore = create<AudioState>((set, get) => ({
  volume: initial.volume,
  muted: initial.muted,
  setVolume: (v) => {
    const volume = Math.max(0, Math.min(1, v));
    const muted = volume === 0 ? true : false;
    set({ volume, muted });
    persist({ volume, muted });
  },
  setMuted: (m) => {
    set({ muted: m });
    persist({ volume: get().volume, muted: m });
  },
  effectiveVolume: () => {
    const { volume, muted } = get();
    return muted ? 0 : volume;
  },
}));
