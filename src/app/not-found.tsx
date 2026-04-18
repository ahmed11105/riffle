import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-amber-100">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border-4 border-stone-900 bg-stone-50 p-8 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
            404
          </div>
          <h1 className="mt-2 text-3xl font-black">Track not found.</h1>
          <p className="mt-3 text-sm text-stone-600">
            That URL isn&rsquo;t in the catalog. Try a different page.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-sm font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
        >
          Back to lobby
        </Link>
      </div>
    </main>
  );
}
