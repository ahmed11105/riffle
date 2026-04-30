"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FLY_COINS_EVENT,
  emitCoinsArrived,
  type FlyCoinsDetail,
} from "@/lib/coinFly";

// Global animation layer. Listens for fly-coin events, spawns small
// Riffs icons at the source rect, animates each toward the
// #riffs-balance-target in the corner using the Web Animations API,
// then emits coins-arrived so the badge can tick its count up.
//
// Pure portal child — outside the React rendering tree of any page —
// so coins glide above modals / banners without z-index headaches.

type Coin = {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delay: number;
  duration: number;
  jitterX: number;
  jitterY: number;
  amount: number;
  isLast: boolean;
};

let nextId = 1;

export function CoinFlyLayer() {
  const [mounted, setMounted] = useState(false);
  const [coins, setCoins] = useState<Coin[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handle(e: Event) {
      const detail = (e as CustomEvent<FlyCoinsDetail>).detail;
      if (!detail) return;
      const target = document.getElementById("riffs-balance-target");
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const toX = rect.left + rect.width / 2;
      const toY = rect.top + rect.height / 2;

      const newCoins: Coin[] = [];
      for (let i = 0; i < detail.count; i++) {
        // Stagger so they don't all leave at once. Each one finishes
        // shortly after the previous lands — feels like a stream.
        const delay = i * 50;
        const duration = 700 + Math.random() * 200;
        // Small offsets at the source so they don't perfectly stack.
        const jitterX = (Math.random() - 0.5) * 24;
        const jitterY = (Math.random() - 0.5) * 24;
        newCoins.push({
          id: nextId++,
          fromX: detail.sourceX + jitterX,
          fromY: detail.sourceY + jitterY,
          toX,
          toY,
          delay,
          duration,
          jitterX,
          jitterY,
          amount: detail.amount,
          isLast: i === detail.count - 1,
        });
      }

      setCoins((prev) => [...prev, ...newCoins]);

      // Last coin's total flight time = max delay + duration.
      const lastDelay = (detail.count - 1) * 50;
      const lastDuration = 700 + 200;
      const arriveMs = lastDelay + lastDuration - 100; // bump the badge slightly before the last icon vanishes
      window.setTimeout(() => emitCoinsArrived(detail.amount), arriveMs);
    }
    window.addEventListener(FLY_COINS_EVENT, handle);
    return () => window.removeEventListener(FLY_COINS_EVENT, handle);
  }, []);

  function handleEnd(id: number) {
    setCoins((prev) => prev.filter((c) => c.id !== id));
  }

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[200] overflow-hidden"
    >
      {coins.map((c) => (
        <FlyingCoin key={c.id} coin={c} onEnd={() => handleEnd(c.id)} />
      ))}
    </div>,
    document.body,
  );
}

function FlyingCoin({ coin, onEnd }: { coin: Coin; onEnd: () => void }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!el) return;
    // Mid-flight control point gives the arc a slight upward curve
    // so they don't go in a straight line — feels more "tossed".
    const midX = (coin.fromX + coin.toX) / 2 + (Math.random() - 0.5) * 60;
    const midY = Math.min(coin.fromY, coin.toY) - 80 - Math.random() * 60;
    const anim = el.animate(
      [
        {
          transform: `translate(${coin.fromX}px, ${coin.fromY}px) scale(0.6)`,
          opacity: 0,
          offset: 0,
        },
        {
          transform: `translate(${coin.fromX}px, ${coin.fromY}px) scale(1)`,
          opacity: 1,
          offset: 0.08,
        },
        {
          transform: `translate(${midX}px, ${midY}px) scale(1.15) rotate(180deg)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(${coin.toX}px, ${coin.toY}px) scale(0.5) rotate(360deg)`,
          opacity: 0.6,
          offset: 1,
        },
      ],
      {
        duration: coin.duration,
        delay: coin.delay,
        easing: "cubic-bezier(0.5, 0.05, 0.6, 1)",
        fill: "forwards",
      },
    );
    anim.onfinish = onEnd;
    anim.oncancel = onEnd;
    return () => anim.cancel();
  }, [el, coin, onEnd]);

  return (
    <div
      ref={setEl}
      className="absolute -left-3 -top-3 h-6 w-6"
      style={{
        backgroundImage: "url('/riff-icon.png')",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.6))",
      }}
    />
  );
}
