'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { UserCircle, LogIn, LogOut, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'ponhak@gmail.com'

export function NavBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { session } = useAuth()
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!isHome) return
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  const small = !isHome || scrolled
  const logoHeight = small ? 52 : 110
  const logoTop    = small ? (56 - 52) / 2 : 8

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.replace('/')
  }

  const firstName = session?.user.user_metadata?.name?.split(' ')[0]
    ?? session?.user.email?.split('@')[0]
    ?? ''

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

      {/* Large overhanging title — home page at rest only */}
      {isHome && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 110,
            top: 8,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 52,
            lineHeight: 0.95,
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            color: '#fff',
            opacity: small ? 0 : 1,
            pointerEvents: 'none',
            transition: 'opacity .18s ease',
            userSelect: 'none',
          }}
        >
          <div>PGA</div>
          <div>Schager</div>
        </div>
      )}

      {/* Title + user icon */}
      <div
        style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          paddingLeft: 64,
          paddingRight: 6,
          gap: 4,
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
            opacity: small ? 1 : 0,
            transition: 'opacity .18s ease',
          }}
        >
          PGA Schager
        </div>

        {/* User button */}
        <div style={{ position: 'relative' }}>
          <button
            aria-label={session ? 'Account menu' : 'Sign in'}
            onClick={() => session ? setMenuOpen(v => !v) : router.push('/login')}
            style={{
              width: 44,
              height: 44,
              background: 'transparent',
              border: 0,
              color: '#F5EFE0',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              padding: 0,
            }}
          >
            {session ? (
              <>
                <UserCircle size={20} strokeWidth={2} />
                <span style={{ fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--trophy-gold)', lineHeight: 1 }}>
                  {firstName.slice(0, 8)}
                </span>
              </>
            ) : (
              <>
                <LogIn size={20} strokeWidth={2} />
                <span style={{ fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, color: '#B9C5D9', lineHeight: 1 }}>
                  Login
                </span>
              </>
            )}
          </button>

          {/* Dropdown menu */}
          {menuOpen && session && (
            <>
              {/* Backdrop */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 29 }}
                onClick={() => setMenuOpen(false)}
              />
              <div style={{
                position: 'absolute',
                top: 46,
                right: 0,
                zIndex: 30,
                background: '#fff',
                border: '1px solid var(--bunker-sand-deep)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-pop)',
                minWidth: 180,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--bunker-sand-deep)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{firstName}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2, wordBreak: 'break-all' }}>{session.user.email}</div>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); router.push('/players') }}
                  style={menuItem()}
                >
                  <Users size={15} strokeWidth={2} />
                  Field
                </button>
                {session.user.email === ADMIN_EMAIL && (
                  <button
                    onClick={() => { setMenuOpen(false); router.push('/admin') }}
                    style={menuItem()}
                  >
                    <ShieldCheck size={15} strokeWidth={2} />
                    Admin
                  </button>
                )}
                <button onClick={handleLogout} style={menuItem(true)}>
                  <LogOut size={15} strokeWidth={2} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function menuItem(danger = false): React.CSSProperties {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    background: 'transparent',
    border: 0,
    borderBottom: '1px solid var(--bunker-sand-deep)',
    color: danger ? 'var(--tournament-red)' : 'var(--ink)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  }
}
