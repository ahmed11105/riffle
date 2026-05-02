"use client";

import { useEffect, useState } from "react";

// Shared backdrop + scale-from-icon animation for any modal triggered
// by an icon button. Owns the entry/exit animation, escape handling,
// and click-outside-to-close. Children render inside the scaling
// container, so each modal keeps its own internal layout (crown
// medallion, accent gradient, etc.) without re-implementing the
// animation each time.
//
// originRect: viewport-coords bounding rect of the icon that opened
// the modal. The card animates FROM that point (translated + scaled
// down to ~icon size) INTO the centered final position. Using a
// translate offset rather than a transform-origin is the only way to
// hit the correct viewport coord regardless of viewport size — the
// element's own coordinate system depends on its flex-centered
// position, which differs at every breakpoint.

export type OriginRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  originRect?: OriginRect | null;
  ariaLabel?: string;
  // Class on the inner scaling container — the modal's outer wrapper.
  contentClassName?: string;
  children: React.ReactNode;
};

export function IconModalShell({
  open,
  onClose,
  originRect,
  ariaLabel,
  contentClassName,
  children,
}: Props) {
  // We keep the modal mounted through the exit animation so the
  // scale-out and backdrop fade play before unmount.
  const [mounted, setMounted] = useState(false);
  const [animatedIn, setAnimatedIn] = useState(false);
  // Icon→center translate offset for the entry/exit anim. We compute
  // it directly from window dimensions and originRect — the card is
  // flex-centered so its center IS the viewport center. No DOM
  // measurement needed, which avoids racing the React render that
  // would otherwise leave the FROM transform un-applied.
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (open) {
      setMounted(true);
      setAnimatedIn(false);
      if (originRect && typeof window !== "undefined") {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const ix = originRect.left + originRect.width / 2;
        const iy = originRect.top + originRect.height / 2;
        setOffset({ x: ix - cx, y: iy - cy });
      } else {
        setOffset({ x: 0, y: 0 });
      }
      // Two-frame delay so the FROM transform paints once before the
      // TO transform kicks in — the transition needs both endpoints
      // to actually render to interpolate.
      const r1 = requestAnimationFrame(() => {
        const r2 = requestAnimationFrame(() => setAnimatedIn(true));
        return () => cancelAnimationFrame(r2);
      });
      return () => cancelAnimationFrame(r1);
    }
    if (mounted) {
      setAnimatedIn(false);
      const t = window.setTimeout(() => setMounted(false), 280);
      return () => window.clearTimeout(t);
    }
  }, [open, originRect, mounted]);

  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  const initialTransform = `translate3d(${offset.x}px, ${offset.y}px, 0) scale(0.08)`;
  const finalTransform = "translate3d(0, 0, 0) scale(1)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={`fixed inset-0 z-[80] flex items-center justify-center px-4 transition-colors duration-200 ${
        animatedIn ? "bg-stone-950/80" : "bg-stone-950/0"
      }`}
      onClick={onClose}
    >
      {/* Blur is applied via a separate sibling that fades opacity
          rather than animating backdrop-filter directly. Animating
          the filter on a full-viewport element is GPU-expensive on
          large displays and stutters the card animation. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: animatedIn ? 1 : 0 }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className={contentClassName}
        style={{
          willChange: "transform, opacity",
          transform: animatedIn ? finalTransform : initialTransform,
          opacity: animatedIn ? 1 : 0,
          transition: animatedIn
            ? "transform 360ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms cubic-bezier(0.16, 1, 0.3, 1)"
            : "transform 260ms cubic-bezier(0.7, 0, 0.84, 0), opacity 200ms cubic-bezier(0.7, 0, 0.84, 0)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
