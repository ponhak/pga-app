'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Clock, CalendarDays, Trophy } from 'lucide-react'

const tabs = [
  { id: 'home',     href: '/',           label: 'Home',     Icon: Home },
  { id: 'schedule', href: '/schedule',   label: 'Schedule', Icon: CalendarDays },
  { id: 'history',  href: '/history',    label: 'History',  Icon: Trophy },
  { id: 'rounds',   href: '/rounds/new', label: 'Rounds',   Icon: Clock },
]

export function BottomTabBar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        height: 64,
        background: 'rgba(10,34,64,.94)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,.10)',
        display: 'grid',
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
      }}
    >
      {tabs.map(({ id, href, label, Icon }) => {
        const on = isActive(href)
        return (
          <Link
            key={id}
            href={href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              color: on ? 'var(--trophy-gold)' : '#B9C5D9',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.10em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              position: 'relative',
            }}
          >
            {on && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '25%',
                  right: '25%',
                  height: 2,
                  background: 'var(--trophy-gold)',
                  borderRadius: '0 0 2px 2px',
                }}
              />
            )}
            <Icon size={20} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
