'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { ShieldCheck, ChevronLeft, Plus, ChevronRight, X } from 'lucide-react'
import type { Round } from '@/lib/database.types'
import Link from 'next/link'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const ADMIN_EMAIL = 'ponhak@gmail.com'

interface RoundWithScoreCount extends Round {
  scoreCount: number
}

export default function ManageDataPage() {
  const { session, loading } = useAuth()
  const router = useRouter()

  const [rounds, setRounds] = useState<RoundWithScoreCount[]>([])
  const [loadingRounds, setLoadingRounds] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [formDate, setFormDate]         = useState('')
  const [formVenue, setFormVenue]       = useState('')
  const [formTeeTime, setFormTeeTime]   = useState('')
  const [formGroupSize, setFormGroupSize] = useState(4)
  const [saving, setSaving] = useState(false)

  const isAdmin = session?.user.email === ADMIN_EMAIL

  useEffect(() => {
    if (isAdmin) loadRounds()
  }, [isAdmin])

  async function loadRounds() {
    setLoadingRounds(true)
    const { data: roundData } = await db.from('rounds').select('*').order('date', { ascending: false })
    const typedRounds = (roundData as Round[]) ?? []

    if (typedRounds.length === 0) {
      setRounds([])
      setLoadingRounds(false)
      return
    }

    const roundIds = typedRounds.map(r => r.id)
    const { data: scoreData } = await db
      .from('scores')
      .select('round_id, strokes')
      .in('round_id', roundIds)
      .not('strokes', 'is', null)

    const countByRound: Record<string, number> = {}
    for (const s of (scoreData ?? [])) {
      countByRound[s.round_id] = (countByRound[s.round_id] ?? 0) + 1
    }

    setRounds(typedRounds.map(r => ({ ...r, scoreCount: countByRound[r.id] ?? 0 })))
    setLoadingRounds(false)
  }

  async function createRound(e: React.FormEvent) {
    e.preventDefault()
    if (!formDate) { toast.error('Date is required'); return }
    setSaving(true)
    const { data, error } = await db.from('rounds').insert({
      date: formDate,
      notes: formVenue.trim() || null,
      tee_time: formTeeTime.trim() || null,
      group_size: formGroupSize,
    }).select('id').single()

    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }
    toast.success('Round created')
    setSaving(false)
    setShowForm(false)
    setFormDate('')
    setFormVenue('')
    setFormTeeTime('')
    setFormGroupSize(4)
    router.push(`/rounds/${data.id}`)
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

  // Group rounds by year
  const byYear: Record<number, RoundWithScoreCount[]> = {}
  for (const r of rounds) {
    const y = new Date(r.date + 'T12:00:00').getFullYear()
    if (!byYear[y]) byYear[y] = []
    byYear[y].push(r)
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

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
          Manage Data
        </div>
      </div>

      {/* Add Round */}
      <div style={{ padding: '16px 16px 0' }}>
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', height: 48, borderRadius: 10, border: 0,
              background: 'var(--tour-navy)', color: '#F5EFE0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontWeight: 700, fontSize: 14, letterSpacing: '.06em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            Add Round
          </button>
        ) : (
          <form
            onSubmit={createRound}
            style={{
              background: '#fff',
              border: '1px solid var(--bunker-sand-deep)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>New Round</span>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink-faint)', display: 'flex', padding: 4 }}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Date */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6 }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  required
                  style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Venue */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6 }}>
                  Venue
                </label>
                <input
                  type="text"
                  value={formVenue}
                  onChange={e => setFormVenue(e.target.value)}
                  placeholder="e.g. Schager GK"
                  style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Tee time */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6 }}>
                  Tee Time
                </label>
                <input
                  type="time"
                  value={formTeeTime}
                  onChange={e => setFormTeeTime(e.target.value)}
                  style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Group size */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6 }}>
                  Group Size
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[2, 3, 4].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormGroupSize(n)}
                      style={{
                        flex: 1, height: 44, borderRadius: 8,
                        border: '1.5px solid',
                        borderColor: formGroupSize === n ? 'var(--tour-navy)' : 'var(--bunker-sand-deep)',
                        background: formGroupSize === n ? 'var(--tour-navy)' : '#fff',
                        color: formGroupSize === n ? '#F5EFE0' : 'var(--ink)',
                        fontWeight: 700, fontSize: 16, cursor: 'pointer',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '0 16px 16px' }}>
              <button
                type="submit"
                disabled={saving || !formDate}
                style={{
                  width: '100%', height: 48, borderRadius: 10, border: 0,
                  background: saving || !formDate ? '#ccc' : 'var(--tour-navy)',
                  color: '#F5EFE0',
                  fontWeight: 700, fontSize: 14, letterSpacing: '.06em', textTransform: 'uppercase',
                  cursor: saving || !formDate ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Creating…' : 'Create & Enter Scores'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Rounds list by year */}
      <div style={{ padding: '20px 16px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loadingRounds ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14, padding: '32px 0' }}>Loading…</div>
        ) : years.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14, padding: '32px 0' }}>No rounds yet.</div>
        ) : (
          years.map(year => (
            <div key={year}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>{year}</div>
              <div style={{
                background: '#fff',
                border: '1px solid var(--bunker-sand-deep)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-card)',
                overflow: 'hidden',
              }}>
                {byYear[year].map((r, i, arr) => (
                  <Link
                    key={r.id}
                    href={`/rounds/${r.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, background: 'var(--tour-navy)', borderRadius: 8,
                      color: '#F5EFE0', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <div style={{ fontSize: 9, letterSpacing: '.10em', fontWeight: 700 }}>
                        {new Date(r.date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                        {new Date(r.date + 'T12:00:00').getDate()}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                        {new Date(r.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                        {r.notes ?? 'No venue'}{r.tee_time ? ` · ${r.tee_time}` : ''}
                      </div>
                    </div>
                    {r.scoreCount > 0 ? (
                      <span style={{
                        height: 22, padding: '0 9px', borderRadius: 999,
                        fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                        background: 'rgba(31,122,76,.14)', color: 'var(--fairway-green)',
                        display: 'flex', alignItems: 'center', flexShrink: 0,
                      }}>Scored</span>
                    ) : (
                      <span style={{
                        height: 22, padding: '0 9px', borderRadius: 999,
                        fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                        background: 'rgba(10,34,64,.08)', color: 'var(--ink-soft)',
                        display: 'flex', alignItems: 'center', flexShrink: 0,
                      }}>Pending</span>
                    )}
                    <ChevronRight size={16} color="var(--ink-faint)" strokeWidth={2} />
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
