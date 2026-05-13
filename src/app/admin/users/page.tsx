'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { ADMIN_EMAIL } from '@/lib/auth'
import { ShieldCheck, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface Member {
  email: string
  added_at: string
  is_admin: boolean
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-label={on ? 'Revoke admin' : 'Grant admin'}
      style={{
        width: 44, height: 26, borderRadius: 999, border: 0,
        background: on ? 'var(--fairway-green)' : 'var(--bunker-sand-deep)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        position: 'relative',
        flexShrink: 0,
        transition: 'background .18s',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3, left: on ? 21 : 3,
        width: 20, height: 20,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        transition: 'left .18s',
        display: 'block',
      }} />
    </button>
  )
}

export default function UsersPage() {
  const { session, loading, isAdmin } = useAuth()
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function load() {
    const { data, error } = await db
      .from('allowed_emails')
      .select('email, added_at, is_admin')
      .order('added_at')
    if (error) { toast.error('Failed to load members'); return }
    setMembers(data ?? [])
  }

  async function toggleAdmin(email: string, current: boolean) {
    if (email === ADMIN_EMAIL) return
    setToggling(email)
    const { error, count } = await db
      .from('allowed_emails')
      .update({ is_admin: !current })
      .eq('email', email)
      .select('email', { count: 'exact', head: true })
    if (error) {
      toast.error(error.message)
    } else if (count === 0) {
      toast.error('Permission denied — check Supabase RLS policies')
    } else {
      toast.success(`${email} is ${!current ? 'now an admin' : 'no longer an admin'}`)
      await load()
    }
    setToggling(null)
  }

  if (loading) return null

  if (!session || !isAdmin) {
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
          User Roles
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '20px 16px 40px' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>
          Toggle admin access for approved members. The super admin cannot be changed.
        </div>
        <div style={{
          background: '#fff',
          border: '1px solid var(--bunker-sand-deep)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}>
          {members.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
              No approved members yet.
            </div>
          ) : (
            members.map((m, i) => {
              const isSuperAdmin = m.email === ADMIN_EMAIL
              const isToggling = toggling === m.email
              return (
                <div
                  key={m.email}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px',
                    borderBottom: i < members.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none',
                    background: m.is_admin ? 'rgba(31,122,76,.04)' : 'transparent',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: m.is_admin ? 'var(--fairway-green)' : 'var(--bunker-sand-deep)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ShieldCheck
                      size={18}
                      strokeWidth={2}
                      color={m.is_admin ? '#fff' : 'var(--ink-faint)'}
                    />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.email}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
                      {isSuperAdmin
                        ? 'Super admin · always on'
                        : m.is_admin
                          ? 'Admin'
                          : 'Member'}
                    </div>
                  </div>

                  {/* Toggle */}
                  <Toggle
                    on={m.is_admin}
                    disabled={isSuperAdmin || isToggling}
                    onChange={() => toggleAdmin(m.email, m.is_admin)}
                  />
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
