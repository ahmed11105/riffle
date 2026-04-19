"use client";

import { create } from "zustand";

type AudioState = {
  volume: number; // 0..1
  muted: boolean;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  effectiveVolume: () => number;

  // Global playback: tracks the currently playing audio element so a
  // floating bar can control it even when the user navigates away from
  // the page that started playback.
  globalAudio: HTMLAudioElement | null;
  globalOriginPath: string | null;
  globalTrackTitle: string | null;
  globalTrackArtist: string | null;
  globalPlaying: boolean;
  // Clip length the bar should respect. Matches the current level's
  // maxSeconds on the page that registered the audio so bar playback
  // stops at the same boundary (1s / 2s / 4s / 8s / 16s) instead of
  // leaking the full 30s preview.
  globalMaxSeconds: number | null;
  registerAudio: (
    el: HTMLAudioElement,
    originPath: string,
    maxSeconds?: number,
    title?: string,
    artist?: string,
  ) => void;
  updateMaxSeconds: (maxSeconds: number | null) => void;
  unregisterAudio: () => void;
  globalPlay: () => void;
  globalPause: () => void;
  globalStop: () => void;
  globalRewind: () => void;
};

const STORAGE_KEY = "riffle:volume";

function readInitial(): { volume: number; muted: boolean } {
  if (typeof window === "undefined") return { volume: 0.5, muted: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { volume: 0.5, muted: false };
    const parsed = JSON.parse(raw) as { volume?: number; muted?: boolean };
    return {
      volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(1, parsed.volume)) : 0.5,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return { volume: 0.5, muted: false };
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

// Shared stop-timer for bar-initiated playback. Lives outside the store
// so zustand doesn't treat it as reactive state.
let globalStopTimerId: number | null = null;
function clearGlobalStopTimer() {
  if (globalStopTimerId !== null) {
    window.clearTimeout(globalStopTimerId);
    globalStopTimerId = null;
  }
}

export const useAudioStore = create<AudioState>((set, get) => ({
  volume: initial.volume,
  muted: initial.muted,
  setVolume: (v) => {
    const volume = Math.max(0, Math.min(1, v));
    const muted = volume === 0 ? true : false;
    set({ volume, muted });
    persist({ volume, muted });
    // Sync to the global audio element if one exists.
    const el = get().globalAudio;
    if (el) {
      el.volume = muted ? 0 : volume;
      el.muted = muted;
    }
  },
  setMuted: (m) => {
    set({ muted: m });
    persist({ volume: get().volume, muted: m });
    const el = get().globalAudio;
    if (el) el.muted = m;
  },
  effectiveVolume: () => {
    const { volume, muted } = get();
    return muted ? 0 : volume;
  },

  // Global playback state
  globalAudio: null,
  globalOriginPath: null,
  globalTrackTitle: null,
  globalTrackArtist: null,
  globalPlaying: false,
  globalMaxSeconds: null,
  registerAudio: (el, originPath, maxSeconds, title, artist) => {
    // Stop any previously registered audio.
    const prev = get().globalAudio;
    if (prev && prev !== el) {
      prev.pause();
    }
    clearGlobalStopTimer();
    el.volume = get().muted ? 0 : get().volume;
    el.muted = get().muted;
    const onEnded = () => {
      clearGlobalStopTimer();
      set({ globalPlaying: false });
    };
    const onPause = () =>
      set({ globalPlaying: el.currentTime > 0 && !el.paused ? true : false });
    const onPlay = () => set({ globalPlaying: true });
    el.addEventListener("ended", onEnded);
    el.addEventListener("pause", onPause);
    el.addEventListener("play", onPlay);
    set({
      globalAudio: el,
      globalOriginPath: originPath,
      globalTrackTitle: title ?? null,
      globalTrackArtist: artist ?? null,
      globalMaxSeconds: maxSeconds ?? null,
      globalPlaying: !el.paused,
    });
  },
  updateMaxSeconds: (maxSeconds) => {
    set({ globalMaxSeconds: maxSeconds });
  },
  unregisterAudio: () => {
    const el = get().globalAudio;
    if (el) el.pause();
    clearGlobalStopTimer();
    set({
      globalAudio: null,
      globalOriginPath: null,
      globalTrackTitle: null,
      globalTrackArtist: null,
      globalMaxSeconds: null,
      globalPlaying: false,
    });
  },
  globalPlay: () => {
    const el = get().globalAudio;
    if (!el) return;
    clearGlobalStopTimer();
    try {
      el.currentTime = 0;
    } catch {}
    el.play().catch(() => {});
    // Respect the clip-length cap so bar playback matches the game level
    // that registered the audio (1s, 2s, 4s, etc). Falls back to "play
    // the whole clip" if no cap was set.
    const max = get().globalMaxSeconds;
    if (max && max > 0) {
      globalStopTimerId = window.setTimeout(() => {
        const current = get().globalAudio;
        if (current) current.pause();
        globalStopTimerId = null;
      }, max * 1000);
    }
  },
  globalPause: () => {
    const el = get().globalAudio;
    if (el) el.pause();
    clearGlobalStopTimer();
  },
  globalStop: () => {
    get().unregisterAudio();
  },
  globalRewind: () => {
    const el = get().globalAudio;
    if (!el) return;
    clearGlobalStopTimer();
    el.currentTime = 0;
    el.play().catch(() => {});
    const max = get().globalMaxSeconds;
    if (max && max > 0) {
      globalStopTimerId = window.setTimeout(() => {
        const current = get().globalAudio;
        if (current) current.pause();
        globalStopTimerId = null;
      }, max * 1000);
    }
  },
}));
