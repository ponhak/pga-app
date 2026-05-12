'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'

export function NavBar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const logoHeight = scrolled ? 52 : 110
  const logoTop    = scrolled ? (56 - 52) / 2 : 8

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: 56,
        background: '#0A2240',
        borderBottom: '1px solid rgba(255,255,255,.08)',
        overflow: 'visible',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="PGA Schager"
        style={{
          position: 'absolute',
          left: 8,
          top: logoTop,
          height: logoHeight,
          width: 'auto',
          zIndex: 20,
          display: 'block',
          border: 0,
          transition: 'height .22s ease, top .22s ease',
        }}
      />

      {/* Title + bell — padded to clear the badge */}
      <div
        style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 44px',
          alignItems: 'center',
          paddingLeft: 110,
          paddingRight: 6,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: '#F5EFE0',
          }}
        >
          PGA Schager
        </div>

        <button
          aria-label="Alerts"
          style={{
            width: 44,
            height: 44,
            background: 'transparent',
            border: 0,
            color: '#F5EFE0',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
          }}
        >
          <Bell size={20} strokeWidth={2} />
          <span
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--tournament-red)',
            }}
          />
        </button>
      </div>
    </header>
  )
}
