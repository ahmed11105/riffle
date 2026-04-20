"use client";

import Link from "next/link";
import Image from "next/image";
import { useRiffs } from "@/lib/riffs/useRiffs";
import { useAdminMode } from "@/lib/admin";

export function RiffsBadge({ showShopLink = true }: { showShopLink?: boolean }) {
  const { balance, ready } = useRiffs();
  const [adminOn] = useAdminMode();

  // Pre-auth/first-load should read "0" not "-" so new players don't
  // see a dead-looking dash where a number belongs.
  const display = adminOn ? "∞" : ready ? balance : 0;

  return (
    <Link
      href={showShopLink ? "/shop" : "#"}
      aria-label={`${adminOn ? "Unlimited" : balance} Riffs. Open shop.`}
      className="inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 text-sm font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] transition hover:bg-stone-100 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
    >
      <Image
        src="/riff-icon.png"
        alt=""
        width={16}
        height={16}
        className="h-4 w-4"
        priority
      />
      <span>{display}</span>
      <span className="text-[10px] uppercase tracking-wider text-stone-500">Riffs</span>
      {showShopLink && !adminOn && <span aria-hidden className="text-amber-600">+</span>}
    </Link>
  );
}
