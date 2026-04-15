"use client";

type Props = {
  open: boolean;
  onResume: () => void;
  onEnd: () => void;
};

export function PauseModal({ open, onResume, onEnd }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur">
      <div className="mx-4 w-full max-w-sm rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_10px_0_0_rgba(0,0,0,0.9)]">
        <h2 className="text-2xl font-black">Game paused</h2>
        <p className="mt-2 text-sm text-stone-600">
          The clock is frozen. Resume when everyone&rsquo;s ready, or end the game
          to jump to final results.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={onResume}
            className="rounded-full border-4 border-stone-900 bg-amber-400 px-5 py-3 text-lg font-black shadow-[0_4px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="rounded-full border-2 border-stone-900 bg-rose-400 px-5 py-2 text-sm font-black shadow-[0_3px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}
