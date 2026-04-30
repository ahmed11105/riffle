import { SoloGame } from "./SoloGame";

export default function SoloPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <h1 className="mt-6 text-3xl font-black text-amber-100">Solo Unlimited</h1>
      <p className="mb-6 text-sm text-amber-100/60">Endless songs. No pressure.</p>
      <SoloGame />
    </main>
  );
}
