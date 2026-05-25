'use client'

export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { ShieldCheck, Users, Database, CalendarDays, ChevronRight } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

interface AdminCard {
  href: string
  Icon: React.ElementType
  label: string
  desc: string
}

const CARDS: AdminCard[] = [
  { href: '/admin/members',  Icon: ShieldCheck,  label: 'Approved Members',    desc: 'Control who can sign up and access the app' },
  { href: '/admin/field',    Icon: Users,         label: 'Field & Roles',       desc: 'Manage the player roster and admin rights' },
  { href: '/admin/data',     Icon: Database,      label: 'Manage Data',         desc: 'Add historical rounds and correct results' },
  { href: '/admin/planning', Icon: CalendarDays,  label: 'Seasonal Planning',   desc: 'Plan and configure the upcoming season' },
]

export default function AdminHubPage() {
  const { session, loading, isAdmin } = useAuth()
  const router = useRouter()

  if (loading) return null

  if (!session || !isAdmin) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-soft)' }}>
        <ShieldCheck size={40} strokeWidth={1.5} style={{ margin: '0 auto 12px', color: 'var(--ink-faint)' }} />
        <p style={{ fontSize: 15 }}>{!session ? 'You need to be signed in to access this page.' : 'Access denied.'}</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bunker-sand)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{
        background: 'var(--tour-navy)',
        padding: '20px 16px 16px',
        borderBottom: '2px solid var(--trophy-gold)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--trophy-gold)', marginBottom: 4 }}>
          Admin Panel
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>
          Management
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: '20px 16px 32px' }}>
        <div style={{
          background: '#fff',
          border: '1px solid var(--bunker-sand-deep)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}>
          {CARDS.map(({ href, Icon, label, desc }, i) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '16px',
                background: 'transparent',
                border: 0,
                borderBottom: i < CARDS.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: 'var(--tour-navy)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} strokeWidth={1.8} color="#F5EFE0" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{desc}</div>
              </div>
              <ChevronRight size={16} color="var(--ink-faint)" strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
