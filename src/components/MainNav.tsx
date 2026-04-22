import Link from "next/link";
import { AccountButton } from "@/components/AccountButton";

// Shared top-right nav used by every page's header. One source of
// truth so the Daily / Solo / Rooms / Leaderboard / Shop set stays
// consistent everywhere and the Shop pill highlight never drifts.
// Hidden below the sm breakpoint because the mobile drawer covers it.
export function MainNav() {
  return (
    <nav className="hidden items-center gap-6 text-sm font-bold uppercase tracking-wider sm:flex">
      <Link href="/daily" className="hover:text-amber-300">Daily</Link>
      <Link href="/solo" className="hover:text-amber-300">Solo</Link>
      <Link href="/rooms" className="hover:text-amber-300">Rooms</Link>
      <Link href="/leaderboard" className="hover:text-amber-300">Leaderboard</Link>
      <Link
        href="/shop"
        className="inline-flex items-center rounded-full border-2 border-stone-900 bg-amber-400 px-3 py-1 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] transition hover:bg-amber-300 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
      >
        Shop
      </Link>
      <AccountButton />
    </nav>
  );
}
