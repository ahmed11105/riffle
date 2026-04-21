import Link from "next/link";
import { SoloGame } from "./SoloGame";
import { Logo } from "@/components/branding/Logo";
import { MainNav } from "@/components/MainNav";

export default function SoloPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Link href="/"><Logo /></Link>
        <MainNav />
      </header>
      <h1 className="mt-6 text-3xl font-black text-amber-100">Solo Unlimited</h1>
      <p className="mb-6 text-sm text-amber-100/60">Endless songs. No pressure.</p>
      <SoloGame />
    </main>
  );
}
