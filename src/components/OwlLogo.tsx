'use client'

export function OwlLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 130 115"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Golf bag */}
      <rect x="5" y="62" width="16" height="30" rx="3" fill="#7B3F00" />
      <rect x="4" y="56" width="18" height="10" rx="3" fill="#5C2E00" />
      {/* Club shafts */}
      <line x1="9" y1="56" x2="3" y2="22" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" />
      <line x1="13" y1="56" x2="13" y2="18" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="56" x2="24" y2="22" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" />
      {/* Club heads */}
      <rect x="0" y="19" width="8" height="5" rx="1" fill="#999" />
      <rect x="9" y="15" width="9" height="5" rx="1" fill="#999" />
      <rect x="21" y="19" width="8" height="5" rx="1" fill="#999" />

      {/* Body */}
      <ellipse cx="72" cy="76" rx="30" ry="31" fill="currentColor" opacity="0.9" />
      {/* Head */}
      <circle cx="70" cy="41" r="24" fill="currentColor" />
      {/* Ear tufts — slightly lopsided */}
      <polygon points="53,22 46,5 64,19" fill="currentColor" />
      <polygon points="87,22 95,6 78,19" fill="currentColor" />

      {/* Left eye */}
      <circle cx="59" cy="41" r="11" fill="white" />
      <circle cx="56" cy="44" r="7" fill="#1a4731" />
      <circle cx="55" cy="40" r="2.5" fill="white" />
      {/* Left eyelid — half closed */}
      <rect x="48" y="30" width="22" height="9" rx="2" fill="currentColor" />

      {/* Right eye */}
      <circle cx="81" cy="41" r="11" fill="white" />
      <circle cx="84" cy="45" r="7" fill="#1a4731" />
      <circle cx="85" cy="41" r="2.5" fill="white" />
      {/* Right eyelid — more closed (drunker side) */}
      <rect x="70" y="30" width="22" height="13" rx="2" fill="currentColor" />

      {/* Rosy drunk cheeks */}
      <circle cx="51" cy="49" r="7" fill="#ff6666" opacity="0.35" />
      <circle cx="89" cy="49" r="7" fill="#ff6666" opacity="0.35" />

      {/* Beak */}
      <polygon points="70,48 63,56 77,56" fill="#c9a84c" />

      {/* Cigarette */}
      <rect x="77" y="51" width="26" height="4" rx="2" fill="#f5f0e8" opacity="0.95" />
      {/* Filter */}
      <rect x="102" y="50" width="6" height="6" rx="1" fill="#cc5500" />
      {/* Ash */}
      <circle cx="108" cy="58" r="3" fill="#aaa" opacity="0.6" />
      {/* Smoke wisps */}
      <path d="M105 50 Q102 43 105 37 Q108 31 105 25" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" fill="none" />
      <path d="M109 50 Q112 44 109 39" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.25" fill="none" />

      {/* Drunk stars */}
      <text x="109" y="30" fontSize="11" fill="#c9a84c" opacity="0.9" fontFamily="sans-serif">★</text>
      <text x="37" y="18" fontSize="9" fill="#c9a84c" opacity="0.75" fontFamily="sans-serif">★</text>
      <text x="117" y="18" fontSize="7" fill="#c9a84c" opacity="0.6" fontFamily="sans-serif">✦</text>

      {/* Wing lines */}
      <path d="M44 70 Q39 82 45 92" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      <path d="M100 70 Q105 82 99 92" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.3" />

      {/* Feet */}
      <path d="M58 105 L54 113 M58 105 L58 113 M58 105 L62 113" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M84 105 L80 113 M84 105 L84 113 M84 105 L88 113" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
