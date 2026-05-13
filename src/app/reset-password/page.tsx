'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

type PageState = 'verifying' | 'form' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>('verifying')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when it detects the token in the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('form')
      }
    })

    // If no event fires within 4 s, the link is invalid/expired
    const timeout = setTimeout(() => {
      setPageState(s => s === 'verifying' ? 'invalid' : s)
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Password updated')
      router.replace('/')
    }
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bunker-sand)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: 'var(--tour-navy)',
        padding: '28px 20px 24px',
        borderBottom: '2px solid var(--trophy-gold)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--trophy-gold)', marginBottom: 6 }}>
          PGA Schager
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>
          New Password
        </div>
      </div>

      <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pageState === 'verifying' && (
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)', marginTop: 24 }}>
            Verifying link…
          </p>
        )}

        {pageState === 'invalid' && (
          <>
            <div style={{
              background: '#fff', border: '1px solid var(--bunker-sand-deep)',
              borderRadius: 12, padding: '24px 20px', textAlign: 'center',
              boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tournament-red)', marginBottom: 8 }}>
                Link invalid or expired
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                This reset link has expired or already been used. Request a new one.
              </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint)' }}>
              <Link href="/forgot-password" style={{ color: 'var(--ink-soft)', textDecoration: 'none', fontWeight: 600 }}>
                Request a new link
              </Link>
            </p>
          </>
        )}

        {pageState === 'form' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              style={{
                height: 50, borderRadius: 8, border: 0,
                background: loading || !password || !confirm ? '#ccc' : 'var(--fairway-green)',
                color: '#fff',
                fontFamily: 'var(--font-body)', fontWeight: 700,
                fontSize: 15, letterSpacing: '.04em',
                cursor: loading || !password || !confirm ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                marginTop: 4,
              }}
            >
              {loading ? 'Saving…' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function PasswordField({ label, value, onChange, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
        {label}
      </label>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        style={{
          height: 48, padding: '0 14px',
          borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)',
          background: '#fff', color: 'var(--ink)',
          fontFamily: 'var(--font-body)', fontSize: 16,
          outline: 'none', boxSizing: 'border-box', width: '100%',
        }}
      />
    </div>
  )
}
