import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/branding/Logo";
import { ShopClient } from "./ShopClient";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Top up Riffs, unlock themed song packs, and watch a quick ad for bonus Riffs. Riffs are virtual goods with no cash value.",
};

type Pack = {
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  accent_color: string | null;
  is_premium: boolean;
};

// The dynamic part: needs request-time cookies for the user lookup, so it
// has to live behind a Suspense boundary under Cache Components.
async function ShopData() {
  const supabase = await createClient();

  const [{ data: packsData }, { data: { user } }] = await Promise.all([
    supabase
      .from("packs")
      .select("slug, name, description, cover_url, accent_color, is_premium")
      .order("sort_order", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  const packs = (packsData ?? []) as Pack[];

  let unlockedSlugs: string[] = [];
  if (user) {
    const { data: unlocks } = await supabase
      .from("user_pack_unlocks")
      .select("pack_slug")
      .eq("user_id", user.id);
    unlockedSlugs = (unlocks ?? []).map((u: { pack_slug: string }) => u.pack_slug);
  }

  return <ShopClient packs={packs} unlockedSlugs={unlockedSlugs} />;
}

function ShopFallback() {
  return (
    <div className="mt-8 grid gap-6">
      <div className="h-32 rounded-3xl border-4 border-stone-900 bg-amber-400/30 animate-pulse" />
      <div className="h-48 rounded-3xl border-4 border-stone-900 bg-stone-50/10 animate-pulse" />
      <div className="h-32 rounded-3xl border-4 border-stone-900 bg-stone-50/10 animate-pulse" />
    </div>
  );
}

export default function ShopPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10 text-amber-100">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden gap-6 text-sm font-bold uppercase tracking-wider sm:flex">
          <Link href="/daily" className="hover:text-amber-300">Daily</Link>
          <Link href="/solo" className="hover:text-amber-300">Solo</Link>
          <Link href="/rooms" className="hover:text-amber-300">Rooms</Link>
        </nav>
      </header>

      <section className="mt-8 w-full max-w-5xl">
        <h1 className="text-4xl font-black tracking-tight text-amber-100 sm:text-5xl">
          Riffle Shop
        </h1>
        <p className="mt-2 max-w-xl text-amber-100/70">
          Riffs are an in-game currency. Use them on hints and themed packs.
          Riffs have <strong>no cash value</strong>, can&rsquo;t be used in
          wagers, and aren&rsquo;t refundable. See{" "}
          <Link href="/terms" className="underline hover:text-amber-300">
            Terms
          </Link>{" "}
          for details.
        </p>

        <Suspense fallback={<ShopFallback />}>
          <ShopData />
        </Suspense>
      </section>
    </main>
  );
}
