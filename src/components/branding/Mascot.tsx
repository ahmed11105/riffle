// Placeholder mascot: "Boomer" the boombox. Replace with illustrator art later.
export function Mascot({ className = "", size = 96 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 120 100"
      width={size}
      height={(size * 100) / 120}
      className={className}
      aria-hidden
    >
      <g>
        {/* body */}
        <rect x="8" y="18" width="104" height="70" rx="10" fill="#fbbf24" stroke="#1c1917" strokeWidth="4" />
        {/* handle */}
        <rect x="36" y="4" width="48" height="14" rx="7" fill="none" stroke="#1c1917" strokeWidth="4" />
        {/* speakers */}
        <circle cx="32" cy="55" r="18" fill="#fef3c7" stroke="#1c1917" strokeWidth="4" />
        <circle cx="32" cy="55" r="9" fill="#1c1917" />
        <circle cx="32" cy="55" r="3" fill="#fbbf24" />
        <circle cx="88" cy="55" r="18" fill="#fef3c7" stroke="#1c1917" strokeWidth="4" />
        <circle cx="88" cy="55" r="9" fill="#1c1917" />
        <circle cx="88" cy="55" r="3" fill="#fbbf24" />
        {/* tape window */}
        <rect x="50" y="30" width="20" height="8" rx="2" fill="#1c1917" />
        {/* smile */}
        <path d="M54 70 Q60 76 66 70" stroke="#1c1917" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* feet */}
        <rect x="20" y="88" width="12" height="8" rx="2" fill="#1c1917" />
        <rect x="88" y="88" width="12" height="8" rx="2" fill="#1c1917" />
      </g>
    </svg>
  );
}
