import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto w-full px-6 py-6 text-xs text-amber-100/40">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="text-center sm:text-left">
          <span className="font-bold text-amber-100/60">Riffle</span>
          <span className="mx-2">·</span>
          <span>Game of skill, not gambling. Riffs have no cash value.</span>
        </div>
        <nav className="flex gap-4 font-bold uppercase tracking-wider">
          <Link href="/privacy" className="hover:text-amber-300">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-amber-300">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-amber-300">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
