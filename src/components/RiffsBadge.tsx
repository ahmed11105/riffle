"use client";

import Link from "next/link";
import Image from "next/image";
import { useRiffs } from "@/lib/riffs/useRiffs";
import { useAdminMode } from "@/lib/admin";

export function RiffsBadge({ showShopLink = true }: { showShopLink?: boolean }) {
  const { balance, ready } = useRiffs();
  const [adminOn] = useAdminMode();

  const display = adminOn ? "∞" : ready ? balance : "-";

  return (
    <Link
      href={showShopLink ? "/shop" : "#"}
      aria-label={`${adminOn ? "Unlimited" : balance} Riffs. Open shop.`}
      className="inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-amber-400 px-3 py-1 text-sm font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
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
      <span className="text-[10px] uppercase tracking-wider">Riffs</span>
      {showShopLink && !adminOn && <span aria-hidden>+</span>}
    </Link>
  );
}
