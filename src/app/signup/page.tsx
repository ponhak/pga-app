'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export default function SignupPage() {
  const router = useRouter()
  const [name, setName]         = useState('')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // Check allowlist
    const { data: allowed, error: listError } = await db
      .from('allowed_emails')
      .select('email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (listError) {
      toast.error('Allowlist check failed: ' + listError.message)
      setLoading(false)
      return
    }

    if (!allowed) {
      toast.error("Your email isn't on the approved list. Contact Pontus to get access.")
      setLoading(false)
      return
    }

    // Create auth account
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error || !data.user) {
      toast.error(error?.message ?? 'Sign up failed')
      setLoading(false)
      return
    }

    // Save profile
    await db.from('profiles').insert({
      id: data.user.id,
      name: name.trim(),
      phone: phone.trim() || null,
    })

    toast.success('Welcome to PGA Schager!')
    router.replace('/')
    setLoading(false)
  }

  const disabled = loading || !name.trim() || !email || !password

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
          Join the Club
        </div>
        <div style={{ fontSize: 13, color: '#B9C5D9', marginTop: 8 }}>
          Your email must be pre-approved by the admin.
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Full name" type="text" value={name} onChange={setName} autoComplete="name" />
        <Field label="Phone number" type="tel" value={phone} onChange={setPhone} autoComplete="tel" required={false} />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />

        <button type="submit" disabled={disabled} style={primaryBtn(disabled)}>
          <UserPlus size={16} strokeWidth={2} />
          {loading ? 'Creating account…' : 'Create Account'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)', marginTop: 8 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--tour-navy)', fontWeight: 700, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}

function Field({ label, type, value, onChange, autoComplete, required = true }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; autoComplete?: string; required?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
        {label}{!required && <span style={{ fontWeight: 400, color: 'var(--ink-faint)', marginLeft: 4, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
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
