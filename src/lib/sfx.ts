// Web Audio synthesized SFX. No asset files to ship, no licensing.
// Each function creates a tiny AudioContext graph and plays a short cue.

import { useAudioStore } from "./store/audio";

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Step = { freq: number; time: number; dur: number; type?: OscillatorType; gain?: number };

function playSequence(steps: Step[]) {
  const ac = getCtx();
  if (!ac) return;
  const userVolume = useAudioStore.getState().effectiveVolume();
  if (userVolume <= 0) return;
  const master = ac.createGain();
  master.gain.value = 0.22 * userVolume;
  master.connect(ac.destination);
  const now = ac.currentTime;
  for (const s of steps) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = s.type ?? "sine";
    osc.frequency.value = s.freq;
    const start = now + s.time;
    const end = start + s.dur;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(s.gain ?? 0.9, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

// Skip — a quick neutral blip.
export function sfxSkip() {
  playSequence([
    { freq: 520, time: 0, dur: 0.08, type: "triangle" },
  ]);
}

// Wrong — a low descending buzz.
export function sfxWrong() {
  playSequence([
    { freq: 220, time: 0, dur: 0.14, type: "sawtooth", gain: 0.6 },
    { freq: 140, time: 0.12, dur: 0.22, type: "sawtooth", gain: 0.7 },
  ]);
}

// Correct — a bright rising arpeggio (C–E–G–C').
export function sfxCorrect() {
  playSequence([
    { freq: 523.25, time: 0, dur: 0.12, type: "triangle" },
    { freq: 659.25, time: 0.09, dur: 0.12, type: "triangle" },
    { freq: 783.99, time: 0.18, dur: 0.14, type: "triangle" },
    { freq: 1046.5, time: 0.28, dur: 0.24, type: "triangle" },
  ]);
}
