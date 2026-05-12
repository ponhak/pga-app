'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CalendarDays, ChevronRight, Plus, X, MapPin, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface RoundEntry {
  id: string
  date: string
  group_size: number
  notes: string | null
  playerCount: number
  hasScores: boolean
}

type Status = 'upcoming' | 'pending' | 'scored'

function getStatus(entry: RoundEntry, today: string): Status {
  if (entry.date > today) return 'upcoming'
  if (entry.hasScores) return 'scored'
  return 'pending'
}

const STATUS_STYLES: Record<Status, { bg: string; color: string; label: string }> = {
  upcoming: { bg: 'rgba(201,162,74,.18)', color: 'var(--trophy-gold)',    label: 'Upcoming' },
  pending:  { bg: 'rgba(10,34,64,.08)',   color: 'var(--ink-soft)',        label: 'Pending'  },
  scored:   { bg: 'rgba(31,122,76,.14)',  color: 'var(--fairway-green)',   label: 'Scored'   },
}

export default function SchedulePage() {
  const { session } = useAuth()
  const router = useRouter()
  const [rounds, setRounds]     = useState<RoundEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)

  const [formDate,      setFormDate]      = useState('')
  const [formTeeTime,   setFormTeeTime]   = useState('')
  const [formVenue,     setFormVenue]     = useState('')
  const [formGroupSize, setFormGroupSize] = useState('3')

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: roundsData }, { data: rpData }, { data: scoresData }] = await Promise.all([
      db.from('rounds').select('id, date, group_size, notes').order('date', { ascending: false }),
      db.from('round_players').select('round_id, player_id'),
      db.from('scores').select('round_id, strokes'),
    ])

    const rpCount: Record<string, number> = {}
    ;(rpData ?? []).forEach((r: { round_id: string }) => {
      rpCount[r.round_id] = (rpCount[r.round_id] ?? 0) + 1
    })

    const hasScoresMap: Record<string, boolean> = {}
    ;(scoresData ?? []).forEach((s: { round_id: string; strokes: number | null }) => {
      if (s.strokes != null) hasScoresMap[s.round_id] = true
    })

    setRounds(
      (roundsData ?? []).map((r: { id: string; date: string; group_size: number; notes: string | null }) => ({
        ...r,
        playerCount: rpCount[r.id] ?? 0,
        hasScores: hasScoresMap[r.id] ?? false,
      }))
    )
    setLoading(false)
  }

  async function handleDelete(roundId: string) {
    if (!confirm('Remove this round from the schedule?')) return
    const { data: groupIds } = await db.from('groups').select('id').eq('round_id', roundId)
    if (groupIds?.length) {
      await db.from('group_members').delete().in('group_id', groupIds.map((g: { id: string }) => g.id))
      await db.from('groups').delete().eq('round_id', roundId)
    }
    await db.from('round_players').delete().eq('round_id', roundId)
    await db.from('scores').delete().eq('round_id', roundId)
    await db.from('rounds').delete().eq('id', roundId)
    await load()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!formDate) return
    setSaving(true)
    await db.from('rounds').insert({
      date: formDate,
      tee_time: formTeeTime || null,
      group_size: Number(formGroupSize),
      notes: formVenue.trim() || null,
    })
    setFormDate('')
    setFormTeeTime('')
    setFormVenue('')
    setFormGroupSize('3')
    setShowForm(false)
    setSaving(false)
    await load()
  }

  // Scored rounds always live in Past; unscored future rounds are Upcoming
  const upcoming = rounds
    .filter(r => !r.hasScores && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))          // soonest first
  const past = rounds
    .filter(r => r.hasScores || r.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))           // most recent first

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'var(--tour-navy)',
        padding: '20px 16px 16px',
        borderBottom: '2px solid var(--trophy-gold)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--trophy-gold)', marginBottom: 4 }}>
            PGA Schager
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>
            Schedule
          </div>
        </div>
        {session && (
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              width: 40, height: 40, borderRadius: 8,
              background: showForm ? 'rgba(255,255,255,.12)' : 'var(--tournament-red)',
              border: 0, color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label={showForm ? 'Cancel' : 'Add round'}
          >
            {showForm ? <X size={18} strokeWidth={2.5} /> : <Plus size={20} strokeWidth={2.5} />}
          </button>
        )}
      </div>

      {/* Add form */}
      {session && showForm && (
        <form
          onSubmit={handleAdd}
          style={{
            background: 'var(--tour-navy-soft)',
            padding: '16px',
            borderBottom: '1px solid rgba(255,255,255,.10)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--trophy-gold)' }}>
            Schedule a Round
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#B9C5D9', display: 'block', marginBottom: 4 }}>
                Date
              </label>
              <input
                type="date"
                required
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                style={{
                  width: '100%', height: 40, padding: '0 10px',
                  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)',
                  borderRadius: 6, color: '#fff', fontSize: 14, boxSizing: 'border-box',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#B9C5D9', display: 'block', marginBottom: 4 }}>
                First tee <span style={{ color: '#8895AC', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <input
                type="time"
                value={formTeeTime}
                onChange={e => setFormTeeTime(e.target.value)}
                style={{
                  width: '100%', height: 40, padding: '0 10px',
                  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)',
                  borderRadius: 6, color: '#fff', fontSize: 14, boxSizing: 'border-box',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#B9C5D9', display: 'block', marginBottom: 4 }}>
                Venue <span style={{ color: '#8895AC', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Strand GK"
                value={formVenue}
                onChange={e => setFormVenue(e.target.value)}
                style={{
                  width: '100%', height: 40, padding: '0 10px',
                  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)',
                  borderRadius: 6, color: '#fff', fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#B9C5D9', display: 'block', marginBottom: 4 }}>
                Group size
              </label>
              <select
                value={formGroupSize}
                onChange={e => setFormGroupSize(e.target.value)}
                style={{
                  width: '100%', height: 40, padding: '0 10px',
                  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)',
                  borderRadius: 6, color: '#fff', fontSize: 14, boxSizing: 'border-box',
                }}
              >
                {[2,3,4].map(n => <option key={n} value={n}>{n}-ball</option>)}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !formDate}
            style={{
              height: 42, background: saving ? 'rgba(200,16,46,.5)' : 'var(--tournament-red)',
              color: '#fff', border: 0, borderRadius: 6,
              fontWeight: 700, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Add to Schedule'}
          </button>
        </form>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14 }}>Loading…</div>
      ) : rounds.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center' }}>
          <CalendarDays size={40} color="var(--ink-faint)" strokeWidth={1.5} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 6 }}>No rounds yet</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Tap + to schedule your first round</div>
        </div>
      ) : (
        <div>
          {upcoming.length > 0 && (
            <Section label="Upcoming" rounds={upcoming} today={today} session={!!session} onDelete={handleDelete} onNavigate={id => router.push(`/rounds/${id}`)} />
          )}
          {past.length > 0 && (
            <Section label="Past rounds" rounds={past} today={today} session={!!session} onDelete={handleDelete} onNavigate={id => router.push(`/rounds/${id}`)} />
          )}
        </div>
      )}
    </div>
  )
}

function Section({ label, rounds, today, session, onDelete, onNavigate }: {
  label: string
  rounds: RoundEntry[]
  today: string
  session: boolean
  onDelete: (id: string) => void
  onNavigate: (id: string) => void
}) {
  return (
    <section style={{ padding: '20px 16px 8px' }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
        color: 'var(--ink-faint)', marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{
        background: '#fff',
        border: '1px solid var(--bunker-sand-deep)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}>
        {rounds.map((entry, i) => {
          const status = getStatus(entry, today)
          const st = STATUS_STYLES[status]
          const d = new Date(entry.date + 'T12:00:00')
          const canDelete = session && status !== 'scored'
          return (
            <div
              key={entry.id}
              onClick={() => onNavigate(entry.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                borderBottom: i < rounds.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none',
                cursor: 'pointer',
              }}
            >
              {/* Calendar block */}
              <div style={{
                width: 48, height: 48, background: status === 'upcoming' ? 'var(--tour-navy)' : 'var(--bunker-sand-deep)',
                borderRadius: 8, flexShrink: 0,
                color: status === 'upcoming' ? '#F5EFE0' : 'var(--ink)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 9, letterSpacing: '.10em', fontWeight: 700 }}>
                  {d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                  {d.getDate()}
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink)', letterSpacing: '.02em' }}>
                  {d.toLocaleDateString('en-GB', { weekday: 'long' })}
                </div>
                {entry.notes ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MapPin size={10} strokeWidth={2} color="var(--ink-faint)" />
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.notes}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>
                    {entry.playerCount > 0 ? `${entry.playerCount} players · ${entry.group_size}-ball` : `${entry.group_size}-ball groups`}
                  </div>
                )}
              </div>

              {/* Status pill */}
              <span style={{
                flexShrink: 0,
                height: 22, padding: '0 9px', borderRadius: 999,
                fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                background: st.bg, color: st.color,
                display: 'flex', alignItems: 'center',
              }}>
                {st.label}
              </span>

              {canDelete ? (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(entry.id) }}
                  title="Remove round"
                  style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: 6, border: 0,
                    background: 'rgba(200,16,46,.08)', color: 'var(--tournament-red)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              ) : (
                <ChevronRight size={16} color="var(--ink-faint)" strokeWidth={2} />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
