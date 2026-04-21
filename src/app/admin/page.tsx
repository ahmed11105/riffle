import Link from "next/link";
import { Logo } from "@/components/branding/Logo";
import { AdminDashboard } from "./AdminDashboard";

export const metadata = {
  title: "Riffle · Admin",
};

export default function AdminPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <header className="flex w-full max-w-6xl items-center justify-between gap-3">
        <Link href="/"><Logo /></Link>
        <Link
          href="/daily"
          className="rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-stone-900"
        >
          ← Daily
        </Link>
      </header>
      <h1 className="mt-6 text-3xl font-black text-amber-100">Admin</h1>
      <p className="mb-6 text-sm text-amber-100/60">
        Internal tools, requires admin mode.
      </p>
      <AdminDashboard />
    </main>
  );
}
