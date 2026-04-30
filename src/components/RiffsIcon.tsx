"use client";

import Image from "next/image";

// Small reusable Riffs (musical note) icon. Single source of truth so
// the logo size + alt + image path don't drift across consumers.
// Drop this inline ("12 Riffs <RiffsIcon />") or as a corner badge on
// cost buttons.
export function RiffsIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/riff-icon.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`inline-block ${className}`}
      priority
    />
  );
}
