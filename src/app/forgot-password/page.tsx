'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + '/reset-password',
    })
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
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
          Reset Password
        </div>
      </div>

      <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sent ? (
          <>
            <div style={{
              background: '#fff', border: '1px solid var(--bunker-sand-deep)',
              borderRadius: 12, padding: '24px 20px', textAlign: 'center',
              boxShadow: 'var(--shadow-card)',
            }}>
              <Mail size={36} strokeWidth={1.5} style={{ color: 'var(--fairway-green)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
                Check your email
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                We sent a reset link to <strong>{email}</strong>. Click it to choose a new password.
              </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint)' }}>
              <Link href="/login" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
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

            <button
              type="submit"
              disabled={loading || !email.trim()}
              style={{
                height: 50, borderRadius: 8, border: 0,
                background: loading || !email.trim() ? '#ccc' : 'var(--tour-navy)',
                color: '#F5EFE0',
                fontFamily: 'var(--font-body)', fontWeight: 700,
                fontSize: 15, letterSpacing: '.04em',
                cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                marginTop: 4,
              }}
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-faint)', marginTop: 0 }}>
              <Link href="/login" style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
