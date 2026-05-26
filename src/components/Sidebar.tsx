'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarDays, Trophy, CalendarRange, LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { useEffect, useState } from 'react'

const BASE_TABS = [
  { id: 'home',     href: '/',         label: 'Home',         Icon: Home },
  { id: 'schedule', href: '/schedule', label: 'Schedule',     Icon: CalendarDays },
  { id: 'history',  href: '/history',  label: 'History',      Icon: Trophy },
]

const PLANNING_TAB = { id: 'planning', href: '/planning', label: 'Availability', Icon: CalendarRange }

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { session, isAdmin } = useAuth()
  const tabs = session ? [...BASE_TABS, PLANNING_TAB] : BASE_TABS

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  const firstName = session?.user.user_metadata?.name?.split(' ')[0]
    ?? session?.user.email?.split('@')[0]
    ?? ''

  const [player, setPlayer] = useState<{ name: string; avatar_url: string | null } | null>(null)

  useEffect(() => {
    if (!session?.user.email) { setPlayer(null); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any).from('players').select('name, avatar_url').eq('account_email', session.user.email).maybeSingle()
      .then(({ data }: { data: { name: string; avatar_url: string | null } | null }) => setPlayer(data ?? null))
  }, [session?.user.email])

  return (
    <aside
      className="hidden md:flex flex-col"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 220,
        zIndex: 20,
        background: 'rgba(10,34,64,.97)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRight: '1px solid rgba(255,255,255,.10)',
      }}
    >
      {/* Brand */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="PGA Schager" style={{ height: 200, width: 'auto' }} />
        </Link>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {tabs.map(({ id, href, label, Icon }) => {
          const on = isActive(href)
          return (
            <Link
              key={id}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 16px',
                margin: '2px 8px',
                borderRadius: 8,
                textDecoration: 'none',
                color: on ? 'var(--trophy-gold)' : '#B9C5D9',
                background: on ? 'rgba(201,162,74,.12)' : 'transparent',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                transition: 'background .15s, color .15s',
                position: 'relative',
              }}
            >
              {on && (
                <span style={{
                  position: 'absolute',
                  left: 0,
                  top: '20%',
                  bottom: '20%',
                  width: 3,
                  background: 'var(--trophy-gold)',
                  borderRadius: '0 3px 3px 0',
                }} />
              )}
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '8px 0' }}>
        {session ? (
          <>
            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                style={{
                  ...sidebarAction(),
                  color: pathname === '/admin' ? 'var(--trophy-gold)' : '#B9C5D9',
                  background: pathname === '/admin' ? 'rgba(201,162,74,.12)' : 'transparent',
                }}
              >
                <ShieldCheck size={16} strokeWidth={2} />
                Admin
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 16px 10px 9px', margin: '2px 8px', borderRadius: 8 }}>
              <PlayerAvatar
                name={player?.name ?? firstName}
                avatarUrl={player?.avatar_url ?? null}
                size={30}
              />
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#B9C5D9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1 }}>
                {(player?.name ?? firstName).split(' ')[0] || session.user.email}
              </div>
            </div>
            <button onClick={handleLogout} style={sidebarAction(true)}>
              <LogOut size={16} strokeWidth={2} />
              Sign out
            </button>
          </>
        ) : (
          <button onClick={() => router.push('/login')} style={sidebarAction()}>
            <LogIn size={16} strokeWidth={2} />
            Sign in
          </button>
        )}
      </div>
    </aside>
  )
}

function sidebarAction(danger = false): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    margin: '2px 8px',
    borderRadius: 8,
    background: 'transparent',
    border: 0,
    color: danger ? 'var(--tournament-red)' : '#B9C5D9',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    textAlign: 'left',
  }
}
