'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { ShieldCheck, ChevronLeft, Zap, Save, RefreshCw, X } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any
const THIS_YEAR = new Date().getFullYear()

interface PlanRound {
  round_number: number
  name: string
  date: string
  double_points: boolean
  linked_round_id: string | null  // tracks the corresponding schedule round
}

const MONTH_NAMES_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su']

function AvailabilityDatePicker({ value, onChange, blockMap, blockDetails }: {
  value: string
  onChange: (date: string) => void
  blockMap: Record<string, number>
  blockDetails: Record<string, string[]>
}) {
  const parsed    = value ? value.split('-').map(Number) : null
  const [open, setOpen]       = useState(false)
  const [viewYear, setViewYear]   = useState(parsed ? parsed[0] : THIS_YEAR)
  const [viewMonth, setViewMonth] = useState(parsed ? parsed[1] - 1 : new Date().getMonth())

  useEffect(() => {
    if (value) { setViewYear(Number(value.split('-')[0])); setViewMonth(Number(value.split('-')[1]) - 1) }
  }, [value])

  const cnt        = value ? (blockMap[value] ?? 0) : 0
  const borderCol  = cnt >= 2 ? 'var(--tournament-red)' : cnt === 1 ? '#C9A24A' : 'var(--bunker-sand-deep)'
  const bgCol      = cnt >= 2 ? 'rgba(200,16,46,.22)' : cnt === 1 ? 'rgba(201,162,74,.32)' : '#fff'

  function prevMonth() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
  function nextMonth() { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }

  const firstDay    = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const offset      = (firstDay.getDay() + 6) % 7

  function selectDay(day: number) {
    const d = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(d); setOpen(false)
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />}

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', height: 36, padding: '0 10px',
          background: bgCol,
          border: `${cnt > 0 ? '2px' : '1.5px'} solid ${borderCol}`,
          borderRadius: 7, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxSizing: 'border-box', fontFamily: 'var(--font-body)', fontSize: 14,
          color: value ? 'var(--ink)' : 'rgba(0,0,0,.35)',
        }}
      >
        <span>{value || 'yyyy-mm-dd'}</span>
        {cnt > 0 && (
          <span style={{
            minWidth: 18, height: 18, borderRadius: 9, flexShrink: 0,
            background: cnt >= 2 ? 'var(--tournament-red)' : '#C9A24A',
            color: '#fff', fontSize: 10, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>{cnt}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 42, left: 0, zIndex: 50,
          background: '#fff', border: '1px solid var(--bunker-sand-deep)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.18)',
          padding: '12px', width: 252,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={prevMonth} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--bunker-sand-deep)', background: 'transparent', cursor: 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{MONTH_NAMES_LONG[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--bunker-sand-deep)', background: 'transparent', cursor: 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAY_LABELS_SHORT.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayCnt  = blockMap[dateStr] ?? 0
              const names   = blockDetails[dateStr]
              const isSelected = value === dateStr
              const cellBg  = isSelected ? 'var(--tour-navy)' : dayCnt >= 2 ? 'rgba(200,16,46,.30)' : dayCnt === 1 ? 'rgba(201,162,74,.45)' : '#f8f7f4'
              const cellBorder = isSelected ? '2px solid var(--tour-navy)' : dayCnt >= 2 ? '1.5px solid rgba(200,16,46,.5)' : dayCnt === 1 ? '1.5px solid rgba(201,162,74,.6)' : '1px solid transparent'
              return (
                <div
                  key={day}
                  onClick={() => selectDay(day)}
                  title={names?.length ? `Blocked: ${names.join(', ')}` : undefined}
                  style={{
                    aspectRatio: '1', borderRadius: 6, background: cellBg, border: cellBorder,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#fff' : 'var(--ink)', lineHeight: 1 }}>{day}</span>
                  {dayCnt > 0 && !isSelected && (
                    <span style={{
                      position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 6,
                      background: dayCnt >= 2 ? 'var(--tournament-red)' : '#a07c1a',
                      color: '#fff', fontSize: 7, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{dayCnt}</span>
                  )}
                </div>
              )
            })}
          </div>

          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              style={{ marginTop: 10, width: '100%', height: 30, borderRadius: 6, border: '1px solid var(--bunker-sand-deep)', background: 'transparent', color: 'var(--ink-soft)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
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
  const { session, loading, isAdmin } = useAuth()
  const router = useRouter()

  const [year, setYear]               = useState(THIS_YEAR)
  const [planId, setPlanId]           = useState<string | null>(null)
  const [maxFieldSize, setMaxFieldSize] = useState(8)
  const [totalRounds, setTotalRounds]   = useState(8)
  // Separate string states so inputs can be cleared while typing
  const [maxFieldInput, setMaxFieldInput]       = useState('8')
  const [totalRoundsInput, setTotalRoundsInput] = useState('8')
  const [planRounds, setPlanRounds]     = useState<PlanRound[]>([])
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]) // linked_round_ids to cascade-delete on save
  const [saving, setSaving]   = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [blockMap, setBlockMap]         = useState<Record<string, number>>({})
  const [blockDetails, setBlockDetails] = useState<Record<string, string[]>>({})

  const isSynced = planRounds.some(r => r.linked_round_id)

  useEffect(() => {
    if (isAdmin) loadPlan(year)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, isAdmin])

  async function loadPlan(y: number) {
    setDataLoaded(false)
    setPendingDeletions([])

    // Load availability blocks for this year to colour-code date inputs
    const [{ data: blocks }, { data: profiles }] = await Promise.all([
      db.from('availability_blocks')
        .select('date, user_id, user_email')
        .gte('date', `${y}-01-01`)
        .lte('date', `${y}-12-31`),
      db.from('profiles').select('id, name'),
    ])
    const profileMap: Record<string, string> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (profiles ?? []) as any[]) profileMap[p.id] = p.name
    const map: Record<string, number> = {}
    const details: Record<string, string[]> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of (blocks ?? []) as any[]) {
      map[b.date] = (map[b.date] ?? 0) + 1
      if (!details[b.date]) details[b.date] = []
      details[b.date].push(profileMap[b.user_id] ?? b.user_email)
    }
    setBlockMap(map)
    setBlockDetails(details)
    const { data: planArr } = await db
      .from('season_plans')
      .select('*')
      .eq('year', y)
      .limit(1)
    const plan = planArr?.[0] ?? null

    if (plan) {
      setPlanId(plan.id)
      setMaxFieldSize(plan.max_field_size)
      setMaxFieldInput(String(plan.max_field_size))
      setTotalRounds(plan.total_rounds)
      setTotalRoundsInput(String(plan.total_rounds))

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
        linked_round_id: r.round_id ?? null,
      }))
      while (loaded.length < plan.total_rounds) {
        loaded.push({ round_number: loaded.length + 1, name: '', date: '', double_points: false, linked_round_id: null })
      }
      setPlanRounds(loaded)
    } else {
      setPlanId(null)
      setMaxFieldSize(8)
      setMaxFieldInput('8')
      setTotalRounds(8)
      setTotalRoundsInput('8')
      setPlanRounds(Array.from({ length: 8 }, (_, i) => ({
        round_number: i + 1, name: '', date: '', double_points: false, linked_round_id: null,
      })))
    }
    setDataLoaded(true)
  }

  function handleTotalRoundsChange(n: number) {
    const clamped = Math.max(1, Math.min(20, n))
    setTotalRounds(clamped)
    setPlanRounds(prev => {
      if (clamped < prev.length) {
        // Collect linked schedule rounds that will be removed
        const removed = prev.slice(clamped)
        const toDelete = removed.filter(r => r.linked_round_id).map(r => r.linked_round_id!)
        if (toDelete.length > 0) setPendingDeletions(d => [...d, ...toDelete])
      }
      const next = [...prev]
      while (next.length < clamped) {
        next.push({ round_number: next.length + 1, name: '', date: '', double_points: false, linked_round_id: null })
      }
      return next.slice(0, clamped).map((r, i) => ({ ...r, round_number: i + 1 }))
    })
  }

  function updateRound(index: number, updates: Partial<PlanRound>) {
    setPlanRounds(prev => {
      const updated = prev.map((r, i) => i === index ? { ...r, ...updates } : r)
      if (!('date' in updates)) return updated
      // Re-sort by date when a date changes; undated rounds go to the end
      return [...updated]
        .sort((a, b) => {
          if (!a.date && !b.date) return 0
          if (!a.date) return 1
          if (!b.date) return -1
          return a.date.localeCompare(b.date)
        })
        .map((r, i) => ({ ...r, round_number: i + 1 }))
    })
  }

  function removeRound(index: number) {
    setPlanRounds(prev => {
      const removed = prev[index]
      if (removed.linked_round_id) {
        setPendingDeletions(d => [...d, removed.linked_round_id!])
      }
      return prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, round_number: i + 1 }))
    })
    setTotalRounds(n => { const next = n - 1; setTotalRoundsInput(String(next)); return next })
  }

  // Cascade-delete a schedule round and all its related data
  async function cascadeDeleteRound(roundId: string) {
    const { data: groupData } = await db.from('groups').select('id').eq('round_id', roundId)
    const groupIds = (groupData ?? []).map((g: { id: string }) => g.id)
    if (groupIds.length > 0) {
      await db.from('group_members').delete().in('group_id', groupIds)
      await db.from('groups').delete().eq('round_id', roundId)
    }
    await db.from('round_players').delete().eq('round_id', roundId)
    await db.from('scores').delete().eq('round_id', roundId)
    await db.from('rounds').delete().eq('id', roundId)
  }

  // Persist plan rounds to DB (delete-all + re-insert, preserving linked_round_id)
  async function persistPlanRounds(pid: string, rounds: PlanRound[]) {
    await db.from('season_plan_rounds').delete().eq('plan_id', pid)
    if (rounds.length > 0) {
      const { error } = await db.from('season_plan_rounds').insert(
        rounds.map(r => ({
          plan_id: pid,
          round_number: r.round_number,
          name: r.name,
          date: r.date || null,
          double_points: r.double_points,
          round_id: r.linked_round_id || null,
        }))
      )
      if (error) throw error
    }
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

      // Delete removed schedule rounds
      for (const roundId of pendingDeletions) {
        await cascadeDeleteRound(roundId)
      }
      setPendingDeletions([])

      await persistPlanRounds(currentPlanId!, planRounds)
      toast.success('Draft saved')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  async function syncSchedule() {
    const roundsWithDates = planRounds.filter(r => r.date)
    if (roundsWithDates.length === 0) {
      toast.error('Add dates to at least one round before syncing')
      return
    }
    if (!confirm(`Sync ${roundsWithDates.length} round(s) to the schedule?`)) return

    setSyncing(true)
    try {
      // Ensure plan exists first
      let currentPlanId = planId
      if (!currentPlanId) {
        const { data, error } = await db
          .from('season_plans')
          .insert({ year, max_field_size: maxFieldSize, total_rounds: totalRounds, status: 'live' })
          .select('id')
          .single()
        if (error) throw error
        currentPlanId = data.id
        setPlanId(currentPlanId)
      } else {
        await db.from('season_plans').update({ max_field_size: maxFieldSize, total_rounds: totalRounds, status: 'live' }).eq('id', currentPlanId)
      }

      // Delete removed schedule rounds
      for (const roundId of pendingDeletions) {
        await cascadeDeleteRound(roundId)
      }
      setPendingDeletions([])

      // Re-fetch linked_round_ids from DB so stale in-memory state can't cause duplicate inserts
      let freshRounds = planRounds
      if (currentPlanId) {
        const { data: freshPr } = await db
          .from('season_plan_rounds')
          .select('round_number, round_id')
          .eq('plan_id', currentPlanId)
        if (freshPr) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dbMap = Object.fromEntries(freshPr.map((r: any) => [r.round_number, r.round_id as string | null]))
          freshRounds = planRounds.map(r => ({
            ...r,
            linked_round_id: r.linked_round_id ?? dbMap[r.round_number] ?? null,
          }))
        }
      }

      // Sync each plan round that has a date
      const updatedRounds = await Promise.all(freshRounds.map(async r => {
        if (!r.date) return r

        if (r.linked_round_id) {
          // Update existing schedule round
          await db.from('rounds').update({
            date: r.date,
            notes: r.name || null,
            double_points: r.double_points,
            group_size: maxFieldSize,
          }).eq('id', r.linked_round_id)
          return r
        } else {
          // Create new schedule round
          const { data, error } = await db.from('rounds').insert({
            date: r.date,
            group_size: maxFieldSize,
            notes: r.name || null,
            double_points: r.double_points,
          }).select('id').single()
          if (error) throw error
          // Send calendar invite for newly created rounds
          fetch('/api/send-calendar-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId: data.id }),
          }).catch(() => {})
          return { ...r, linked_round_id: data.id as string }
        }
      }))

      setPlanRounds(updatedRounds)
      await persistPlanRounds(currentPlanId!, updatedRounds)
      toast.success('Schedule synced')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.message)
    }
    setSyncing(false)
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
          {dataLoaded && isSynced && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase',
              padding: '3px 9px', borderRadius: 999,
              background: 'rgba(31,122,76,.25)', color: '#6ee7b7',
            }}>
              Synced
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
            <div style={{ background: '#fff', border: '1px solid var(--bunker-sand-deep)', borderRadius: 12, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                <div style={{ padding: '14px 16px', borderRight: '1px solid var(--bunker-sand-deep)' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', display: 'block', marginBottom: 6 }}>
                    Max Field
                  </label>
                  <input
                    type="number" min={2} max={60}
                    value={maxFieldInput}
                    onChange={e => setMaxFieldInput(e.target.value)}
                    onBlur={e => {
                      const n = Math.max(2, Math.min(60, parseInt(e.target.value) || 8))
                      setMaxFieldSize(n)
                      setMaxFieldInput(String(n))
                    }}
                    style={{ ...inputStyle(), width: '100%' }}
                  />
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', display: 'block', marginBottom: 6 }}>
                    Total Rounds
                  </label>
                  <input
                    type="number" min={1} max={20}
                    value={totalRoundsInput}
                    onChange={e => setTotalRoundsInput(e.target.value)}
                    onBlur={e => {
                      const n = Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                      handleTotalRoundsChange(n)
                      setTotalRoundsInput(String(n))
                    }}
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
            <div style={{ background: '#fff', border: '1px solid var(--bunker-sand-deep)', borderRadius: 12, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 130px 44px 32px', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--bunker-sand-deep)', background: 'var(--bunker-sand)' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', lineHeight: '36px' }}>#</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', lineHeight: '36px' }}>Name</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', lineHeight: '36px' }}>Date</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', lineHeight: '36px', textAlign: 'center' }}>2×</span>
                <span />
              </div>

              {planRounds.map((r, i) => (
                <div
                  key={i}
                  style={{ display: 'grid', gridTemplateColumns: '28px 1fr 130px 44px 32px', gap: 8, padding: '10px 14px', alignItems: 'center', borderBottom: i < planRounds.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none', background: r.double_points ? 'rgba(201,162,74,.07)' : 'transparent', transition: 'background .15s' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: r.linked_round_id ? 'var(--fairway-green)' : 'var(--ink-faint)', textAlign: 'center' }}>
                    {r.round_number}
                  </span>
                  <input
                    type="text"
                    placeholder={`Round ${r.round_number}`}
                    value={r.name}
                    onChange={e => updateRound(i, { name: e.target.value })}
                    style={{ ...inputStyle(), width: '100%' }}
                  />
                  <AvailabilityDatePicker
                    value={r.date}
                    onChange={date => updateRound(i, { date })}
                    blockMap={blockMap}
                    blockDetails={blockDetails}
                  />
                  <button
                    type="button"
                    onClick={() => updateRound(i, { double_points: !r.double_points })}
                    title={r.double_points ? 'Double points ON — click to disable' : 'Click to enable double points'}
                    style={{
                      height: 36, borderRadius: 7, border: '2px solid',
                      borderColor: r.double_points ? 'var(--trophy-gold)' : 'var(--bunker-sand-deep)',
                      background: r.double_points ? 'var(--trophy-gold)' : 'transparent',
                      color: r.double_points ? 'var(--tour-navy)' : 'var(--ink-faint)',
                      fontSize: 11, fontWeight: 900, letterSpacing: '.04em', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
                    }}
                  >
                    {r.double_points && <Zap size={10} strokeWidth={3} />}
                    2×
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRound(i)}
                    title="Remove this round"
                    style={{
                      width: 32, height: 36, borderRadius: 7, border: '1.5px solid var(--bunker-sand-deep)',
                      background: 'transparent', color: 'var(--tournament-red)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '20px 16px 0', display: 'flex', gap: 10 }}>
            <button
              onClick={saveDraft}
              disabled={saving || syncing}
              style={{
                flex: 1, height: 44, borderRadius: 8, border: 0,
                cursor: saving || syncing ? 'not-allowed' : 'pointer',
                background: saving || syncing ? '#ccc' : 'var(--tour-navy)',
                color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Save size={15} strokeWidth={2.5} />
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={syncSchedule}
              disabled={saving || syncing}
              style={{
                flex: 1, height: 44, borderRadius: 8, border: 0,
                cursor: saving || syncing ? 'not-allowed' : 'pointer',
                background: saving || syncing ? '#ccc' : 'var(--tournament-red)',
                color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <RefreshCw size={15} strokeWidth={2.5} />
              {syncing ? 'Syncing…' : 'Sync to Schedule'}
            </button>
          </div>

          {pendingDeletions.length > 0 && (
            <div style={{ padding: '10px 16px 0' }}>
              <p style={{ fontSize: 12, color: 'var(--tournament-red)', margin: 0, textAlign: 'center' }}>
                {pendingDeletions.length} linked round(s) will be removed from the schedule on next save.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
