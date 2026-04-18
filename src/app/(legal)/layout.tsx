import Link from "next/link";
import { Logo } from "@/components/branding/Logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10 text-amber-100">
      <header className="flex w-full max-w-3xl items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex gap-6 text-sm font-bold uppercase tracking-wider">
          <Link href="/privacy" className="hover:text-amber-300">Privacy</Link>
          <Link href="/terms" className="hover:text-amber-300">Terms</Link>
        </nav>
      </header>
      <article className="mt-10 w-full max-w-3xl rounded-3xl border-4 border-stone-900 bg-stone-50 p-8 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        {children}
      </article>
      <p className="mt-6 text-xs text-amber-100/40">
        Operated by Riffle. Contact:{" "}
        <a href="mailto:support@riffle.cc" className="underline hover:text-amber-300">
          support@riffle.cc
        </a>
      </p>
    </main>
  );
}
