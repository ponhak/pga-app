'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      router.replace('/')
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
          Sign In
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />

        <button
          type="submit"
          disabled={loading || !email || !password}
          style={primaryBtn(loading || !email || !password)}
        >
          <LogIn size={16} strokeWidth={2} />
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)', marginTop: 8 }}>
          Not a member yet?{' '}
          <Link href="/signup" style={{ color: 'var(--tour-navy)', fontWeight: 700, textDecoration: 'none' }}>
            Request access
          </Link>
        </p>
      </form>
    </div>
  )
}

function Field({ label, type, value, onChange, autoComplete }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; autoComplete?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
        {label}
      </label>
      <input
        type={type}
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

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    height: 50, borderRadius: 8, border: 0,
    background: disabled ? '#ccc' : 'var(--tour-navy)',
    color: '#F5EFE0',
    fontFamily: 'var(--font-body)', fontWeight: 700,
    fontSize: 15, letterSpacing: '.04em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    textTransform: 'uppercase',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 4,
  }
}
