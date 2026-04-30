"use client";

import { useEffect } from "react";
import {
  FLY_COINS_EVENT,
  emitCoinsArrived,
  type FlyCoinsDetail,
} from "@/lib/coinFly";

// Global animation layer. Listens for fly-coin events and animates
// Riffs icons from the source rect to the balance badge in the
// corner.
//
// Implementation note: this used to render coins via React state +
// per-coin component with its own useEffect. That added a render
// pass + commit + effect-flush before each animation could start,
// causing the first frame to feel "stuck". The version below
// bypasses React entirely — it manages its own DOM layer at body
// root, creates each coin element directly, and starts the WAAPI
// animation in the same task as the click event. Result: animations
// kick in on the next frame instead of two frames later.

const PRELOAD_HREF = "/riff-icon.png";

export function CoinFlyLayer() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    // One layer for everyone. No re-renders, no portal churn.
    let layer = document.getElementById("coin-fly-layer") as HTMLDivElement | null;
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "coin-fly-layer";
      layer.setAttribute("aria-hidden", "true");
      layer.style.cssText =
        "position:fixed;inset:0;z-index:200;pointer-events:none;overflow:hidden;";
      document.body.appendChild(layer);
    }

    // Warm the icon cache so the first coin doesn't paint a blank
    // square while the image decodes.
    const preload = new Image();
    preload.src = PRELOAD_HREF;

    function handle(e: Event) {
      const detail = (e as CustomEvent<FlyCoinsDetail>).detail;
      if (!detail) return;
      const target = document.getElementById("riffs-balance-target");
      if (!target || !layer) return;
      const rect = target.getBoundingClientRect();
      const toX = rect.left + rect.width / 2;
      const toY = rect.top + rect.height / 2;

      const { sourceX, sourceY, count, amount } = detail;
      const stagger = 28; // ms between coins — tighter = stream
      const baseDuration = 600;

      for (let i = 0; i < count; i++) {
        const coin = document.createElement("div");
        coin.style.cssText = [
          "position:absolute",
          "left:0",
          "top:0",
          "width:24px",
          "height:24px",
          "margin-left:-12px",
          "margin-top:-12px",
          `background:url('${PRELOAD_HREF}') center/contain no-repeat`,
          "will-change:transform,opacity",
          "transform:translate3d(0,0,0)",
        ].join(";");
        layer.appendChild(coin);

        const jitterX = (Math.random() - 0.5) * 28;
        const jitterY = (Math.random() - 0.5) * 28;
        const fromX = sourceX + jitterX;
        const fromY = sourceY + jitterY;
        const midX = (fromX + toX) / 2 + (Math.random() - 0.5) * 70;
        const midY = Math.min(fromY, toY) - 70 - Math.random() * 50;
        const duration = baseDuration + Math.random() * 180;
        const delay = i * stagger;

        const anim = coin.animate(
          [
            {
              transform: `translate3d(${fromX}px, ${fromY}px, 0) scale(0.5)`,
              opacity: 0,
              offset: 0,
            },
            {
              transform: `translate3d(${fromX}px, ${fromY}px, 0) scale(1)`,
              opacity: 1,
              offset: 0.1,
            },
            {
              transform: `translate3d(${midX}px, ${midY}px, 0) scale(1.1) rotate(180deg)`,
              opacity: 1,
              offset: 0.55,
            },
            {
              transform: `translate3d(${toX}px, ${toY}px, 0) scale(0.5) rotate(360deg)`,
              opacity: 0.65,
              offset: 1,
            },
          ],
          {
            duration,
            delay,
            easing: "cubic-bezier(0.5, 0.05, 0.6, 1)",
            fill: "forwards",
          },
        );
        const cleanup = () => coin.remove();
        anim.onfinish = cleanup;
        anim.oncancel = cleanup;
      }

      const lastDelay = (count - 1) * stagger;
      const arriveMs = lastDelay + baseDuration - 80;
      window.setTimeout(() => emitCoinsArrived(amount), arriveMs);
    }

    window.addEventListener(FLY_COINS_EVENT, handle);
    return () => {
      window.removeEventListener(FLY_COINS_EVENT, handle);
    };
  }, []);

  return null;
}
