'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

interface Block {
  date: string
  user_id: string
  user_email: string
}

export default function PlanningPage() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState<'plan' | 'overview'>('plan')
  const [year, setYear] = useState(new Date().getFullYear())
  const [allBlocks, setAllBlocks] = useState<Block[]>([])
  const [pendingMyBlocks, setPendingMyBlocks] = useState<Set<string>>(new Set())
  const [savedMyBlocks, setSavedMyBlocks] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [unsavedPrompt, setUnsavedPrompt] = useState<(() => void) | null>(null)
  const [profileNames, setProfileNames] = useState<Record<string, string>>({})
  const [roundDates, setRoundDates]     = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!session) return
    const [{ data }, { data: profiles }, { data: rounds }] = await Promise.all([
      db.from('availability_blocks')
        .select('date, user_id, user_email')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`),
      db.from('profiles').select('id, name'),
      db.from('rounds').select('date').gte('date', `${year}-01-01`).lte('date', `${year}-12-31`),
    ])
    setRoundDates(new Set((rounds ?? []).map((r: { date: string }) => r.date)))
    const nameMap: Record<string, string> = {}
    ;(profiles ?? []).forEach((p: { id: string; name: string }) => { nameMap[p.id] = p.name })
    setProfileNames(nameMap)
    const blocks: Block[] = data ?? []
    setAllBlocks(blocks)
    const mine = new Set(
      blocks.filter(r => r.user_email === session.user.email).map(r => r.date)
    )
    setSavedMyBlocks(mine)
    setPendingMyBlocks(new Set(mine))
    setSelectedDate(null)
  }, [session, year])

  useEffect(() => {
    if (session) load()
  }, [session, load])

  function blockCount(dateStr: string) {
    return allBlocks.filter(b => b.date === dateStr).length
  }

  function dayBg(dateStr: string) {
    if (roundDates.has(dateStr)) return 'rgba(31,122,76,.18)'
    const count = blockCount(dateStr)
    if (count === 0) return '#fff'
    if (count === 1) return 'rgba(201,162,74,.28)'
    return 'rgba(200,16,46,.22)'
  }

  function hasChanges() {
    if (pendingMyBlocks.size !== savedMyBlocks.size) return true
    for (const d of pendingMyBlocks) if (!savedMyBlocks.has(d)) return true
    return false
  }

  function toggleDate(dateStr: string) {
    setPendingMyBlocks(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  function guardChanges(action: () => void) {
    if (mode === 'plan' && hasChanges()) {
      setUnsavedPrompt(() => action)
    } else {
      action()
    }
  }

  async function saveAndContinue() {
    await save()
    const pending = unsavedPrompt
    setUnsavedPrompt(null)
    pending?.()
  }

  async function save() {
    if (!session) return
    setSaving(true)
    const uid = session.user.id
    const email = session.user.email!
    const toAdd = [...pendingMyBlocks].filter(d => !savedMyBlocks.has(d))
    const toRemove = [...savedMyBlocks].filter(d => !pendingMyBlocks.has(d))
    const errors: string[] = []
    if (toAdd.length) {
      const { error } = await db.from('availability_blocks').insert(
        toAdd.map(date => ({ user_id: uid, user_email: email, date }))
      )
      if (error) errors.push(error.message)
    }
    if (toRemove.length) {
      const { error } = await db.from('availability_blocks')
        .delete().in('date', toRemove).eq('user_id', uid)
      if (error) errors.push(error.message)
    }
    if (errors.length) {
      toast.error(errors[0])
    } else {
      toast.success('Availability saved')
      await load()
    }
    setSaving(false)
  }

  if (loading) return null

  if (!session) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-soft)' }}>
        <CalendarRange size={40} strokeWidth={1.5} style={{ margin: '0 auto 12px', color: 'var(--ink-faint)' }} />
        <p style={{ fontSize: 15 }}>Sign in to view availability.</p>
      </div>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div style={{ background: 'var(--bunker-sand)', minHeight: '100%', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        background: 'var(--tour-navy)',
        padding: '20px 16px 16px',
        borderBottom: '2px solid var(--trophy-gold)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--trophy-gold)', marginBottom: 4 }}>
          Members
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>
          Availability
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--bunker-sand-deep)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {(['plan', 'overview'] as const).map(m => (
            <button
              key={m}
              onClick={() => guardChanges(() => { setMode(m); setSelectedDate(null) })}
              style={{
                padding: '9px 14px',
                border: 0,
                background: mode === m ? 'var(--tour-navy)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--ink-soft)',
                fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background .15s, color .15s',
              }}
            >
              {m === 'plan' ? 'My Availability' : 'Overview'}
            </button>
          ))}
        </div>

        {/* Year selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button onClick={() => guardChanges(() => setYear(y => y - 1))} style={chevBtn()}><ChevronLeft size={16} strokeWidth={2.5} /></button>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', minWidth: 42, textAlign: 'center' }}>{year}</span>
          <button onClick={() => guardChanges(() => setYear(y => y + 1))} style={chevBtn()}><ChevronRight size={16} strokeWidth={2.5} /></button>
        </div>

      </div>

      {/* Legend */}
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {mode === 'plan' && (
          <LegendItem dot color="var(--tournament-red)" label="Your blocked dates" />
        )}
        <LegendItem color="rgba(31,122,76,.45)" label="Scheduled round" />
        <LegendItem color="rgba(201,162,74,.7)" label="1 person blocked" />
        <LegendItem color="rgba(200,16,46,.5)" label="2+ people blocked" />
      </div>

      {/* Floating save button */}
      {mode === 'plan' && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}>
          <button
            onClick={save}
            disabled={saving || !hasChanges()}
            style={{
              height: 48, width: 220, borderRadius: 10, border: 0,
              background: saving || !hasChanges() ? '#ccc' : 'var(--fairway-green)',
              color: '#fff',
              fontWeight: 700, fontSize: 13, letterSpacing: '.10em', textTransform: 'uppercase',
              cursor: saving || !hasChanges() ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,.28)',
              transition: 'background .15s',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {/* Unsaved changes popup */}
      {unsavedPrompt && (
        <>
          <div
            onClick={() => setUnsavedPrompt(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.45)' }}
          />
          <div style={{
            position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 41,
            background: '#fff',
            borderRadius: 16,
            padding: '28px 24px 20px',
            width: 'min(320px, calc(100vw - 40px))',
            boxShadow: '0 8px 40px rgba(0,0,0,.28)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
              Unsaved changes
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 24, lineHeight: 1.5 }}>
              Do you want to save your availability before leaving?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setUnsavedPrompt(null); unsavedPrompt?.() }}
                style={{
                  flex: 1, height: 44, borderRadius: 10, border: '1.5px solid var(--bunker-sand-deep)',
                  background: 'transparent', color: 'var(--ink)', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                No
              </button>
              <button
                onClick={saveAndContinue}
                disabled={saving}
                style={{
                  flex: 1, height: 44, borderRadius: 10, border: 0,
                  background: saving ? '#ccc' : 'var(--fairway-green)',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Yes, save'}
              </button>
            </div>
            <button
              onClick={() => setUnsavedPrompt(null)}
              style={{
                marginTop: 14, background: 'transparent', border: 0,
                color: 'var(--ink-faint)', fontSize: 12, cursor: 'pointer',
                fontWeight: 600, letterSpacing: '.04em',
              }}
            >
              Continue planning
            </button>
          </div>
        </>
      )}

      {/* Calendar months */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
        {MONTH_NAMES.map((monthName, monthIdx) => {
          const firstDay = new Date(year, monthIdx, 1)
          const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
          // Mon=0 offset; JS getDay() 0=Sun → convert: (day+6)%7
          const offset = (firstDay.getDay() + 6) % 7

          return (
            <div key={monthIdx}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--tour-navy)', marginBottom: 8 }}>
                {monthName}
              </div>

              {/* Weekday headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', gap: 4, marginBottom: 4 }}>
                {DAY_LABELS.map(d => (
                  <div key={d} style={{ width: 36, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', textAlign: 'center' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', gap: 4 }}>
                {Array.from({ length: offset }).map((_, i) => (
                  <div key={`e${i}`} style={{ width: 36, height: 36 }} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const cellDate = new Date(year, monthIdx, day)
                  const isPast = cellDate < today
                  const isMyPending = pendingMyBlocks.has(dateStr)
                  const blockers = allBlocks.filter(b => b.date === dateStr)
                  const isSelected = selectedDate === dateStr

                  function handleClick() {
                    if (isPast) return
                    if (mode === 'plan') {
                      toggleDate(dateStr)
                    } else {
                      setSelectedDate(isSelected ? null : dateStr)
                    }
                  }

                  return (
                    <div
                      key={day}
                      onClick={handleClick}
                      style={{
                        width: 36, height: 36,
                        borderRadius: 8,
                        background: dayBg(dateStr),
                        border: isSelected
                          ? '2px solid var(--tour-navy)'
                          : '1.5px solid rgba(0,0,0,.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                        cursor: isPast ? 'default' : 'pointer',
                        opacity: isPast ? 0.35 : 1,
                        boxSizing: 'border-box',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>
                        {day}
                      </span>

                      {/* Plan mode: own block dot */}
                      {mode === 'plan' && isMyPending && (
                        <span style={{
                          position: 'absolute', top: 4, right: 4,
                          width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--tournament-red)',
                          display: 'block',
                        }} />
                      )}

                      {/* Overview mode: count badge */}
                      {mode === 'overview' && blockers.length > 0 && (
                        <span style={{
                          position: 'absolute', top: 3, right: 3,
                          background: blockers.length >= 2 ? 'var(--tournament-red)' : '#a07c1a',
                          color: '#fff',
                          fontSize: 8, fontWeight: 700,
                          borderRadius: 3,
                          padding: '1px 3px',
                          lineHeight: 1.3,
                        }}>
                          {blockers.length}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Overview inline panel — appears under the month when a date in it is selected */}
              {mode === 'overview' && selectedDate?.startsWith(`${year}-${String(monthIdx + 1).padStart(2, '0')}-`) && (
                <div style={{
                  marginTop: 12,
                  background: '#fff',
                  border: '1px solid var(--bunker-sand-deep)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  boxShadow: 'var(--shadow-card)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  {allBlocks.filter(b => b.date === selectedDate).length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Nobody blocked this date.</div>
                  ) : (
                    allBlocks
                      .filter(b => b.date === selectedDate)
                      .map(b => (
                        <div key={b.user_email} style={{ fontSize: 13, color: 'var(--ink)', padding: '3px 0', fontWeight: 500 }}>
                          {profileNames[b.user_id] ?? b.user_email}
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LegendItem({ color, dot, label }: { color: string; dot?: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: dot ? 10 : 16,
        height: dot ? 10 : 16,
        borderRadius: dot ? '50%' : 4,
        background: color,
        flexShrink: 0,
        border: dot ? 'none' : '1px solid rgba(0,0,0,.12)',
      }} />
      <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{label}</span>
    </div>
  )
}

function chevBtn(): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 6,
    border: '1px solid var(--bunker-sand-deep)',
    background: '#fff', color: 'var(--ink)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
  }
}
