import Link from "next/link";
import { SoloGame } from "./SoloGame";
import { Logo } from "@/components/branding/Logo";

export default function SoloPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <header className="flex w-full max-w-md items-center justify-between">
        <Link href="/"><Logo /></Link>
      </header>
      <h1 className="mt-6 text-3xl font-black text-amber-100">Solo Unlimited</h1>
      <p className="mb-6 text-sm text-amber-100/60">Endless songs. No pressure.</p>
      <SoloGame />
    </main>
  );
}
