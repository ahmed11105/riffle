import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeGuess(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(feat|ft|featuring)\.?\b.*/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function fuzzyMatchTitle(guess: string, actual: string): boolean {
  const g = normalizeGuess(guess);
  const a = normalizeGuess(actual);
  if (!g || !a) return false;
  if (g === a) return true;
  if (a.startsWith(g) && g.length >= Math.max(4, a.length * 0.6)) return true;
  if (g.startsWith(a)) return true;
  return levenshtein(g, a) <= Math.max(1, Math.floor(a.length * 0.15));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array(b.length + 1).fill(0).map((_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}
