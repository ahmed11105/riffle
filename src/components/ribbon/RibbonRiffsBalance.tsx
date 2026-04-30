"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAdminMode } from "@/lib/admin";
import { RiffsIcon } from "@/components/RiffsIcon";
import { COINS_ARRIVED_EVENT } from "@/lib/coinFly";

// Riffs balance pill that lives on the right of the ribbon. Carries
// the #riffs-balance-target id — every coin-flight animation lands
// here. Pops + briefly turns green when coins arrive. Click → /shop.
//
// The "+" corner badge serves both as a top-up affordance hint and
// as a visual matched to other addictive games' currency widgets.
export function RibbonRiffsBalance() {
  const { profile, loading } = useAuth();
  const [adminOn] = useAdminMode();
  const [pop, setPop] = useState(false);

  useEffect(() => {
    function handle() {
      setPop(true);
      window.setTimeout(() => setPop(false), 600);
    }
    window.addEventListener(COINS_ARRIVED_EVENT, handle);
    return () => window.removeEventListener(COINS_ARRIVED_EVENT, handle);
  }, []);

  if (loading) return null;
  const balance = profile?.coin_balance ?? 0;
  const display = adminOn ? "∞" : balance;

  return (
    <Link
      href="/shop"
      id="riffs-balance-target"
      aria-label={`${adminOn ? "Unlimited" : balance} Riffs. Open shop.`}
      className={[
        "relative inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-stone-900 px-3.5 py-1.5 text-sm font-black text-amber-50 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] transition-transform",
        pop ? "scale-110" : "scale-100",
      ].join(" ")}
    >
      <RiffsIcon size={18} />
      <span className={pop ? "text-emerald-300" : ""}>{display}</span>
      <span
        aria-hidden
        className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-400 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
      >
        <Plus className="h-3 w-3" strokeWidth={4} />
      </span>
    </Link>
  );
}
