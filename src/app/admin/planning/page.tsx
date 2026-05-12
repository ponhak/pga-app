'use client'

export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { ShieldCheck, ChevronLeft, CalendarDays } from 'lucide-react'

const ADMIN_EMAIL = 'ponhak@gmail.com'

export default function PlanningPage() {
  const { session, loading } = useAuth()
  const router = useRouter()

  if (loading) return null

  if (!session || session.user.email !== ADMIN_EMAIL) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-soft)' }}>
        <ShieldCheck size={40} strokeWidth={1.5} style={{ margin: '0 auto 12px', color: 'var(--ink-faint)' }} />
        <p style={{ fontSize: 15 }}>Access denied.</p>
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
        <button
          onClick={() => router.push('/admin')}
          style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', padding: 0, marginBottom: 10 }}
        >
          <ChevronLeft size={14} strokeWidth={2.5} /> Admin
        </button>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--trophy-gold)', marginBottom: 4 }}>
          Admin
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>
          Seasonal Planning
        </div>
      </div>

      {/* Placeholder */}
      <div style={{ padding: '64px 24px', textAlign: 'center' }}>
        <CalendarDays size={48} strokeWidth={1.2} color="var(--ink-faint)" style={{ margin: '0 auto 16px' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink)', marginBottom: 8 }}>
          Coming Soon
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', maxWidth: 260, margin: '0 auto' }}>
          Seasonal planning tools will be available here in a future update.
        </div>
      </div>
    </div>
  )
}
