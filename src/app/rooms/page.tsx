"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/branding/Logo";
import { Mascot } from "@/components/branding/Mascot";
import { loadLocalPlayer, saveLocalPlayer } from "@/lib/rooms";
import { adminHeaders } from "@/lib/admin";
import { MainNav } from "@/components/MainNav";

export default function RoomsPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomsCapped, setRoomsCapped] = useState(false);
  const [shortPlaceholder, setShortPlaceholder] = useState(false);

  useEffect(() => {
    const existing = loadLocalPlayer();
    if (existing) setName(existing.name);
  }, []);

  // Swap the join input's placeholder from "Room code" to "Code" on
  // narrow viewports so the longer text doesn't push the Join button
  // outside the card.
  useEffect(() => {
    function check() {
      setShortPlaceholder(window.innerWidth < 380);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function createRoom() {
    if (!name.trim()) {
      setError("Enter a name first");
      return;
    }
    setError(null);
    setCreating(true);
    saveLocalPlayer(name);
    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: adminHeaders(),
      });
      const json = (await res.json()) as {
        code?: string;
        error?: string;
        message?: string;
      };
      if (res.status === 402 && json.error === "rooms_capped") {
        setRoomsCapped(true);
        setError(json.message ?? "You've hit today's free room cap.");
        setCreating(false);
        return;
      }
      if (!res.ok || !json.code) throw new Error(json.message ?? json.error ?? "create failed");
      router.push(`/rooms/${json.code}?host=1`);
    } catch (e) {
      setError(String(e));
      setCreating(false);
    }
  }

  async function joinRoom() {
    if (!name.trim()) {
      setError("Enter a name first");
      return;
    }
    if (!code.trim()) {
      setError("Enter a room code");
      return;
    }
    setError(null);
    setJoining(true);
    saveLocalPlayer(name);
    router.push(`/rooms/${code.trim().toUpperCase()}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Link href="/"><Logo /></Link>
        <MainNav />
      </header>

      <section className="mt-10 flex w-full max-w-md flex-col items-center text-center">
        <Mascot size={120} className="mb-3 drop-shadow-[0_8px_0_rgba(0,0,0,0.9)]" />
        <h1 className="text-5xl font-black leading-none tracking-tighter text-amber-100">
          Play with Friends
        </h1>
        <p className="mt-3 text-amber-100/70">
          Create a room, share the code, and wager game points each round.
        </p>

        <div className="mt-6 w-full rounded-3xl border-4 border-stone-900 bg-stone-50 p-5 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
          <label className="block text-left text-xs font-bold uppercase tracking-wider text-stone-500">
            Your name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="e.g. Alex"
            className="mt-1 w-full rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-2.5 font-black text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-300"
          />

          <button
            type="button"
            onClick={createRoom}
            disabled={creating}
            className="mt-4 w-full rounded-full border-4 border-stone-900 bg-amber-400 px-5 py-3 text-base font-black shadow-[0_4px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create a Room"}
          </button>

          <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-stone-400">
            <div className="h-px flex-1 bg-stone-300" />
            or join
            <div className="h-px flex-1 bg-stone-300" />
          </div>

          <div className="flex w-full gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={shortPlaceholder ? "Code" : "Room code"}
              maxLength={6}
              className="min-w-0 flex-1 rounded-full border-2 border-stone-900 bg-stone-100 px-3 py-2.5 text-center font-mono text-lg font-black tracking-widest text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-300 sm:px-4"
            />
            <button
              type="button"
              onClick={joinRoom}
              disabled={joining || code.length < 4}
              className="shrink-0 rounded-full border-2 border-stone-900 bg-stone-900 px-3 py-2.5 text-sm font-black text-stone-50 transition hover:bg-stone-800 disabled:opacity-50 sm:px-5"
            >
              Join
            </button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </div>
          )}

          {roomsCapped && (
            <div className="mt-3 rounded-2xl border-2 border-stone-900 bg-amber-100 p-3 text-sm">
              <p className="font-black">Free tier: one Friends room per day.</p>
              <p className="mt-1 text-stone-700">
                Try again tomorrow, or unlock unlimited rooms with Riffle Pro.
              </p>
              <Link
                href="/shop?upsell=rooms_capped#pro"
                className="mt-2 inline-flex items-center rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
              >
                See Pro →
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
