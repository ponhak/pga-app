'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Trophy, CalendarRange } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

const BASE_TABS = [
  { id: 'home',     href: '/',         label: 'Home',     Icon: Home },
  { id: 'schedule', href: '/schedule', label: 'Schedule', Icon: CalendarDays },
  { id: 'history',  href: '/history',  label: 'History',  Icon: Trophy },
]

const PLANNING_TAB = { id: 'planning', href: '/planning', label: 'Availability', Icon: CalendarRange }

export function BottomTabBar() {
  const pathname = usePathname()
  const { session } = useAuth()
  const tabs = session ? [...BASE_TABS, PLANNING_TAB] : BASE_TABS

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="grid md:hidden"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(10,34,64,.94)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,.10)',
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        alignItems: 'start',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
              height: 64,
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
