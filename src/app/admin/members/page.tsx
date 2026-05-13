'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { X, Plus, ShieldCheck, ChevronLeft } from 'lucide-react'
import { ADMIN_EMAIL } from '@/lib/auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface AllowedEmail {
  email: string
  added_at: string
}

export default function MembersPage() {
  const { session, loading, isAdmin } = useAuth()
  const router = useRouter()
  const [emails, setEmails]     = useState<AllowedEmail[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (isAdmin) loadEmails()
  }, [isAdmin])

  async function loadEmails() {
    const { data } = await db.from('allowed_emails').select('email, added_at').order('added_at')
    setEmails(data ?? [])
  }

  async function addEmail(e: React.FormEvent) {
    e.preventDefault()
    const val = newEmail.toLowerCase().trim()
    if (!val) return
    setSaving(true)
    const { error } = await db.from('allowed_emails').insert({ email: val })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`${val} added to allowlist`)
      setNewEmail('')
      await loadEmails()
    }
    setSaving(false)
  }

  async function removeEmail(email: string) {
    if (!confirm(`Remove ${email} from the allowlist?`)) return
    const { error } = await db.from('allowed_emails').delete().eq('email', email)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`${email} removed`)
      await loadEmails()
    }
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
          Approved Members
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={addEmail} style={{ padding: '16px', display: 'flex', gap: 10 }}>
        <input
          type="email"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          placeholder="new@email.com"
          style={{
            flex: 1, height: 44, padding: '0 14px',
            borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)',
            background: '#fff', color: 'var(--ink)',
            fontFamily: 'var(--font-body)', fontSize: 15, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="submit"
          disabled={saving || !newEmail.trim()}
          style={{
            height: 44, padding: '0 16px', borderRadius: 8, border: 0,
            background: saving || !newEmail.trim() ? '#ccc' : 'var(--tour-navy)',
            color: '#F5EFE0', cursor: saving || !newEmail.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontWeight: 700, fontSize: 14, letterSpacing: '.04em', textTransform: 'uppercase',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Add
        </button>
      </form>

      {/* Email list */}
      <div style={{ padding: '0 16px 32px' }}>
        <div style={{
          background: '#fff',
          border: '1px solid var(--bunker-sand-deep)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}>
          {emails.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
              No approved emails yet.
            </div>
          ) : (
            emails.map((e, i) => (
              <div key={e.email} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                borderBottom: i < emails.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>{e.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
                    Added {new Date(e.added_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <button
                  onClick={() => removeEmail(e.email)}
                  disabled={e.email === ADMIN_EMAIL}
                  style={{
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                    background: 'transparent',
                    border: '1px solid var(--bunker-sand-deep)',
                    color: e.email === ADMIN_EMAIL ? 'var(--ink-faint)' : 'var(--tournament-red)',
                    cursor: e.email === ADMIN_EMAIL ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: e.email === ADMIN_EMAIL ? 0.4 : 1,
                  }}
                  aria-label={`Remove ${e.email}`}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
