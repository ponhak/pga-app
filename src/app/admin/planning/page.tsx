'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { ShieldCheck, ChevronLeft, Zap, Save, SendHorizonal } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const ADMIN_EMAIL = 'ponhak@gmail.com'
const THIS_YEAR = new Date().getFullYear()

interface PlanRound {
  round_number: number
  name: string
  date: string
  double_points: boolean
}

function inputStyle(overrides?: React.CSSProperties): React.CSSProperties {
  return {
    height: 36, padding: '0 10px',
    background: '#fff', border: '1.5px solid var(--bunker-sand-deep)',
    borderRadius: 7, color: 'var(--ink)', fontSize: 14,
    fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
    ...overrides,
  }
}

export default function PlanningPage() {
  const { session, loading } = useAuth()
  const router = useRouter()

  const [year, setYear]               = useState(THIS_YEAR)
  const [planId, setPlanId]           = useState<string | null>(null)
  const [planStatus, setPlanStatus]   = useState<string>('draft')
  const [maxFieldSize, setMaxFieldSize] = useState(20)
  const [totalRounds, setTotalRounds]   = useState(8)
  const [planRounds, setPlanRounds]     = useState<PlanRound[]>([])
  const [saving, setSaving]   = useState(false)
  const [pushing, setPushing] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  const isAdmin = session?.user.email === ADMIN_EMAIL

  useEffect(() => {
    if (isAdmin) loadPlan(year)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, isAdmin])

  async function loadPlan(y: number) {
    setDataLoaded(false)
    const { data: planArr } = await db
      .from('season_plans')
      .select('*')
      .eq('year', y)
      .limit(1)
    const plan = planArr?.[0] ?? null

    if (plan) {
      setPlanId(plan.id)
      setPlanStatus(plan.status)
      setMaxFieldSize(plan.max_field_size)
      setTotalRounds(plan.total_rounds)

      const { data: pr } = await db
        .from('season_plan_rounds')
        .select('*')
        .eq('plan_id', plan.id)
        .order('round_number')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loaded: PlanRound[] = (pr ?? []).map((r: any) => ({
        round_number: r.round_number,
        name: r.name ?? '',
        date: r.date ?? '',
        double_points: r.double_points ?? false,
      }))
      while (loaded.length < plan.total_rounds) {
        loaded.push({ round_number: loaded.length + 1, name: '', date: '', double_points: false })
      }
      setPlanRounds(loaded)
    } else {
      setPlanId(null)
      setPlanStatus('draft')
      setMaxFieldSize(20)
      setTotalRounds(8)
      setPlanRounds(Array.from({ length: 8 }, (_, i) => ({
        round_number: i + 1, name: '', date: '', double_points: false,
      })))
    }
    setDataLoaded(true)
  }

  function handleTotalRoundsChange(n: number) {
    const clamped = Math.max(1, Math.min(20, n))
    setTotalRounds(clamped)
    setPlanRounds(prev => {
      const next = [...prev]
      while (next.length < clamped) {
        next.push({ round_number: next.length + 1, name: '', date: '', double_points: false })
      }
      return next.slice(0, clamped).map((r, i) => ({ ...r, round_number: i + 1 }))
    })
  }

  function updateRound(index: number, updates: Partial<PlanRound>) {
    setPlanRounds(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r))
  }

  async function saveDraft() {
    setSaving(true)
    try {
      let currentPlanId = planId

      if (!currentPlanId) {
        const { data, error } = await db
          .from('season_plans')
          .insert({ year, max_field_size: maxFieldSize, total_rounds: totalRounds, status: 'draft' })
          .select('id')
          .single()
        if (error) throw error
        currentPlanId = data.id
        setPlanId(currentPlanId)
      } else {
        const { error } = await db
          .from('season_plans')
          .update({ max_field_size: maxFieldSize, total_rounds: totalRounds })
          .eq('id', currentPlanId)
        if (error) throw error
      }

      await db.from('season_plan_rounds').delete().eq('plan_id', currentPlanId)
      if (planRounds.length > 0) {
        const { error } = await db.from('season_plan_rounds').insert(
          planRounds.map(r => ({
            plan_id: currentPlanId,
            round_number: r.round_number,
            name: r.name,
            date: r.date || null,
            double_points: r.double_points,
          }))
        )
        if (error) throw error
      }

      toast.success('Draft saved')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  async function pushLive() {
    const roundsWithDates = planRounds.filter(r => r.date)
    if (roundsWithDates.length === 0) {
      toast.error('Add dates to at least one round before going live')
      return
    }
    if (!confirm(`This will add ${roundsWithDates.length} placeholder round(s) to the schedule for ${year}. Continue?`)) return

    setPushing(true)
    try {
      // Save draft first to make sure planId exists
      if (!planId) await saveDraft()

      for (const r of roundsWithDates) {
        const { error } = await db.from('rounds').insert({
          date: r.date,
          group_size: maxFieldSize,
          notes: r.name || null,
          double_points: r.double_points,
        })
        if (error) throw error
      }

      const { error } = await db
        .from('season_plans')
        .update({ status: 'live' })
        .eq('year', year)
      if (error) throw error

      setPlanStatus('live')
      toast.success(`${roundsWithDates.length} rounds added to the schedule`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.message)
    }
    setPushing(false)
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

  const isLive = planStatus === 'live'

  return (
    <div style={{ background: 'var(--bunker-sand)', minHeight: '100%', paddingBottom: 40 }}>

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
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>
            Seasonal Planning
          </div>
          {dataLoaded && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase',
              padding: '3px 9px', borderRadius: 999,
              background: isLive ? 'rgba(31,122,76,.25)' : 'rgba(201,162,74,.20)',
              color: isLive ? '#6ee7b7' : 'var(--trophy-gold)',
            }}>
              {isLive ? 'Live' : 'Draft'}
            </span>
          )}
        </div>
      </div>

      {/* Year selector */}
      <div style={{ padding: '16px 16px 0', display: 'flex', gap: 8 }}>
        {[THIS_YEAR, THIS_YEAR + 1].map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            style={{
              height: 34, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer',
              fontWeight: 700, fontSize: 13, letterSpacing: '.06em',
              background: year === y ? 'var(--tour-navy)' : 'rgba(10,34,64,.08)',
              color: year === y ? '#fff' : 'var(--ink-soft)',
            }}
          >
            {y}
          </button>
        ))}
      </div>

      {!dataLoaded ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          {/* Season Setup */}
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
              Season Setup
            </div>
            <div style={{
              background: '#fff', border: '1px solid var(--bunker-sand-deep)',
              borderRadius: 12, boxShadow: 'var(--shadow-card)', overflow: 'hidden',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {/* Max Field Size */}
                <div style={{ padding: '14px 16px', borderRight: '1px solid var(--bunker-sand-deep)' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', display: 'block', marginBottom: 6 }}>
                    Max Field
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={maxFieldSize}
                    onChange={e => setMaxFieldSize(parseInt(e.target.value) || 20)}
                    style={{ ...inputStyle(), width: '100%' }}
                  />
                </div>
                {/* Total Rounds */}
                <div style={{ padding: '14px 16px' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', display: 'block', marginBottom: 6 }}>
                    Total Rounds
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={totalRounds}
                    onChange={e => handleTotalRoundsChange(parseInt(e.target.value) || 1)}
                    style={{ ...inputStyle(), width: '100%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Point Structure note */}
          <div style={{ padding: '10px 16px 0' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={12} color="var(--trophy-gold)" strokeWidth={2.5} />
              Toggle <strong style={{ color: 'var(--ink)' }}>2×</strong> on any round to award double points when scored.
            </div>
          </div>

          {/* Round Schedule */}
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
              Round Schedule
            </div>
            <div style={{
              background: '#fff', border: '1px solid var(--bunker-sand-deep)',
              borderRadius: 12, boxShadow: 'var(--shadow-card)', overflow: 'hidden',
            }}>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 130px 44px',
                gap: 8, padding: '8px 14px',
                borderBottom: '1px solid var(--bunker-sand-deep)',
                background: 'var(--bunker-sand)',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', lineHeight: '36px' }}>#</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', lineHeight: '36px' }}>Name</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', lineHeight: '36px' }}>Date</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', lineHeight: '36px', textAlign: 'center' }}>2×</span>
              </div>

              {planRounds.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid', gridTemplateColumns: '28px 1fr 130px 44px',
                    gap: 8, padding: '10px 14px', alignItems: 'center',
                    borderBottom: i < planRounds.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-faint)', textAlign: 'center' }}>
                    {r.round_number}
                  </span>
                  <input
                    type="text"
                    placeholder={`Round ${r.round_number}`}
                    value={r.name}
                    onChange={e => updateRound(i, { name: e.target.value })}
                    style={{ ...inputStyle(), width: '100%' }}
                  />
                  <input
                    type="date"
                    value={r.date}
                    onChange={e => updateRound(i, { date: e.target.value })}
                    style={{ ...inputStyle(), width: '100%', colorScheme: 'light' }}
                  />
                  {/* Double points toggle */}
                  <button
                    type="button"
                    onClick={() => updateRound(i, { double_points: !r.double_points })}
                    style={{
                      height: 36, borderRadius: 7, border: '1.5px solid',
                      borderColor: r.double_points ? 'var(--trophy-gold)' : 'var(--bunker-sand-deep)',
                      background: r.double_points ? 'rgba(201,162,74,.15)' : 'transparent',
                      color: r.double_points ? 'var(--trophy-gold)' : 'var(--ink-faint)',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      letterSpacing: '.04em',
                    }}
                    title={r.double_points ? 'Double points (click to remove)' : 'Normal points (click for 2×)'}
                  >
                    2×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '20px 16px 0', display: 'flex', gap: 10 }}>
            <button
              onClick={saveDraft}
              disabled={saving}
              style={{
                flex: 1, height: 44, borderRadius: 8, border: 0, cursor: saving ? 'not-allowed' : 'pointer',
                background: saving ? '#ccc' : 'var(--tour-navy)',
                color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Save size={15} strokeWidth={2.5} />
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={pushLive}
              disabled={pushing || isLive}
              title={isLive ? 'Already pushed live' : 'Push rounds to schedule'}
              style={{
                flex: 1, height: 44, borderRadius: 8, border: 0,
                cursor: pushing || isLive ? 'not-allowed' : 'pointer',
                background: isLive ? 'rgba(31,122,76,.12)' : pushing ? '#ccc' : 'var(--tournament-red)',
                color: isLive ? 'var(--fairway-green)' : '#fff',
                fontWeight: 700, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <SendHorizonal size={15} strokeWidth={2.5} />
              {isLive ? 'Live ✓' : pushing ? 'Pushing…' : 'Push Live'}
            </button>
          </div>

          {isLive && (
            <div style={{ padding: '10px 16px 0' }}>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0, textAlign: 'center' }}>
                Rounds are live. Edit them individually from the Schedule or Manage Data pages.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
