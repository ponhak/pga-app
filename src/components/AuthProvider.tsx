'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ADMIN_EMAIL } from '@/lib/auth'
import type { Session } from '@supabase/supabase-js'

interface AuthCtxValue {
  session: Session | null
  loading: boolean
  isAdmin: boolean
}

const AuthCtx = createContext<AuthCtxValue>({ session: null, loading: true, isAdmin: false })

async function resolveAdmin(s: Session | null): Promise<boolean> {
  if (!s?.user.email) return false
  if (s.user.email === ADMIN_EMAIL) return true
  const { data } = await supabase
    .from('allowed_emails')
    .select('is_admin')
    .eq('email', s.user.email)
    .single()
  return data?.is_admin === true
}

async function touchProfile(s: Session | null) {
  if (!s?.user) return
  await supabase.from('profiles').upsert({
    id: s.user.id,
    email: s.user.email,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'id' })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      setIsAdmin(await resolveAdmin(data.session))
      touchProfile(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      setIsAdmin(await resolveAdmin(s))
      touchProfile(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  return <AuthCtx.Provider value={{ session, loading, isAdmin }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
