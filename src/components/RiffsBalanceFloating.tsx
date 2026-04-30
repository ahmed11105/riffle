"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAdminMode } from "@/lib/admin";
import { RiffsIcon } from "@/components/RiffsIcon";
import { COINS_ARRIVED_EVENT } from "@/lib/coinFly";

// Fixed top-left Riffs balance pill, always visible. Doubles as the
// landing target for the coin-flight animation — the #riffs-balance-target
// id is what CoinFlyLayer queries for the destination rect.
//
// On riffle:coins-arrived, the balance "pops" briefly + scales up to
// signal the deposit, then settles back. Real value is read from the
// auth profile (which the claim handler refreshes).
export function RiffsBalanceFloating() {
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
        "fixed left-4 top-3 z-40 inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 text-sm font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] transition-transform sm:left-6 sm:top-5",
        pop ? "scale-125" : "scale-100",
      ].join(" ")}
    >
      <RiffsIcon size={16} />
      <span className={pop ? "text-emerald-700" : ""}>{display}</span>
    </Link>
  );
}
