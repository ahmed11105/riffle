"use client";

type Props = {
  label: string;
  remaining: number;
  total: number;
};

export function PhaseCountdown({ label, remaining, total }: Props) {
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-2">
      <div className="flex w-full items-baseline justify-between text-xs font-bold uppercase tracking-wider text-amber-100/60">
        <span>{label}</span>
        <span className="font-mono text-amber-200">{remaining}s</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border-2 border-stone-900 bg-stone-900">
        <div
          className="h-full bg-amber-400 transition-[width] duration-200 ease-linear"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
