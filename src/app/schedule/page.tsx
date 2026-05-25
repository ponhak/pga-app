'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CalendarDays, CalendarPlus, ChevronRight, MapPin, Pencil, X, Save } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { generateICS } from '@/lib/calendar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface RoundEntry {
  id: string
  date: string
  tee_time: string | null
  group_size: number
  notes: string | null
  double_points: boolean
  playerCount: number
  hasScores: boolean
  blockedCount: number
}

type Status = 'upcoming' | 'pending' | 'scored'

function getStatus(entry: RoundEntry, today: string): Status {
  if (entry.date > today) return 'upcoming'
  if (entry.hasScores) return 'scored'
  return 'pending'
}

const STATUS_STYLES: Record<Status, { bg: string; color: string; label: string }> = {
  upcoming: { bg: 'rgba(201,162,74,.18)', color: 'var(--trophy-gold)',  label: 'Upcoming' },
  pending:  { bg: 'rgba(10,34,64,.08)',   color: 'var(--ink-soft)',      label: 'Pending'  },
  scored:   { bg: 'rgba(31,122,76,.14)',  color: 'var(--fairway-green)', label: 'Scored'   },
}

function inputStyle(overrides?: React.CSSProperties): React.CSSProperties {
  return {
    height: 38, padding: '0 10px',
    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)',
    borderRadius: 6, color: '#fff', fontSize: 13, boxSizing: 'border-box',
    colorScheme: 'dark', ...overrides,
  }
}

export default function SchedulePage() {
  const { session } = useAuth()
  const router = useRouter()
  const [rounds, setRounds]   = useState<RoundEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editDate,     setEditDate]     = useState('')
  const [editTeeTime,  setEditTeeTime]  = useState('')
  const [editVenue,    setEditVenue]    = useState('')
  const [editSaving,   setEditSaving]   = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: roundsData }, { data: rpData }, { data: scoresData }] = await Promise.all([
      db.from('rounds').select('id, date, tee_time, group_size, notes, double_points').order('date', { ascending: false }),
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

    const upcomingDates = (roundsData ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => !hasScoresMap[r.id] && r.date >= today)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.date as string)

    const blockedMap: Record<string, number> = {}
    if (upcomingDates.length > 0) {
      const { data: blocks } = await db
        .from('availability_blocks')
        .select('date')
        .in('date', upcomingDates)
      ;(blocks ?? []).forEach((b: { date: string }) => {
        blockedMap[b.date] = (blockedMap[b.date] ?? 0) + 1
      })
    }

    setRounds(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (roundsData ?? []).map((r: any) => ({
        ...r,
        double_points: r.double_points ?? false,
        playerCount: rpCount[r.id] ?? 0,
        hasScores: hasScoresMap[r.id] ?? false,
        blockedCount: blockedMap[r.date] ?? 0,
      }))
    )
    setLoading(false)
  }

  function startEdit(entry: RoundEntry, e: React.MouseEvent) {
    e.stopPropagation()
    if (editingId === entry.id) { setEditingId(null); return }
    setEditingId(entry.id)
    setEditDate(entry.date)
    setEditTeeTime(entry.tee_time ?? '')
    setEditVenue(entry.notes ?? '')
  }

  async function saveEdit(e: React.MouseEvent) {
    e.stopPropagation()
    if (!editingId) return
    const entry = rounds.find(r => r.id === editingId)
    setEditSaving(true)
    const { error } = await db.from('rounds').update({
      date: editDate || undefined,
      tee_time: editTeeTime || null,
      notes: editVenue.trim() || null,
    }).eq('id', editingId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Round updated')
      // Send updated invite if date, tee time, or venue changed
      if (entry && (editDate !== entry.date || editTeeTime !== (entry.tee_time ?? '') || editVenue !== (entry.notes ?? ''))) {
        fetch('/api/send-calendar-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roundId: editingId, isUpdate: true }),
        }).catch(() => {})
      }
      setEditingId(null)
      await load()
    }
    setEditSaving(false)
  }

  function downloadICS(entry: RoundEntry) {
    try {
      const ics = generateICS({ id: entry.id, date: entry.date, tee_time: entry.tee_time, notes: entry.notes })
      const blob = new Blob([ics], { type: 'text/calendar' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pga-round-${entry.date}.ics`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to generate calendar file')
    }
  }

  const upcoming = rounds
    .filter(r => !r.hasScores && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const pending = rounds
    .filter(r => !r.hasScores && r.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
  const currentYear = new Date().getFullYear().toString()
  const past = rounds
    .filter(r => r.hasScores && r.date.startsWith(currentYear))
    .sort((a, b) => b.date.localeCompare(a.date))

  function renderSection(label: string, entries: RoundEntry[]) {
    return (
      <section className="md:flex-1 md:min-w-[280px]" style={{ padding: '20px 16px 8px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
          {label}
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--bunker-sand-deep)', borderRadius: 12, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          {entries.map((entry, i) => {
            const status = getStatus(entry, today)
            const st = STATUS_STYLES[status]
            const d = new Date(entry.date + 'T12:00:00')
            const canEdit = !!session && status !== 'scored'
            const isEditing = editingId === entry.id

            return (
              <div
                key={entry.id}
                style={{ borderBottom: i < entries.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none' }}
              >
                {/* Card row */}
                <div
                  onClick={() => { if (status === 'upcoming') return; router.push(`/rounds/${entry.id}`) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: status === 'upcoming' ? 'default' : 'pointer' }}
                >
                  {/* Calendar block */}
                  <div style={{
                    width: 48, height: 48,
                    background: status === 'upcoming' ? 'var(--tour-navy)' : 'var(--bunker-sand-deep)',
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
                    {status === 'upcoming' && entry.blockedCount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                          color: entry.blockedCount >= 2 ? 'var(--tournament-red)' : '#B07800',
                        }}>
                          ⚠ {entry.blockedCount} unavailable
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Double points badge */}
                  {entry.double_points && (
                    <span style={{
                      flexShrink: 0, height: 24, padding: '0 9px', borderRadius: 999,
                      fontSize: 11, fontWeight: 900, letterSpacing: '.04em',
                      background: 'var(--trophy-gold)', color: 'var(--tour-navy)',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      ⚡ 2×
                    </span>
                  )}

                  {/* Status pill — only for past rounds (upcoming section header is sufficient) */}
                  {status !== 'upcoming' && (
                    <span style={{
                      flexShrink: 0, height: 22, padding: '0 9px', borderRadius: 999,
                      fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                      background: st.bg, color: st.color, display: 'flex', alignItems: 'center',
                    }}>
                      {st.label}
                    </span>
                  )}

                  {/* Add to calendar — upcoming rounds, logged-in users only */}
                  {status === 'upcoming' && !!session && (
                    <button
                      onClick={e => { e.stopPropagation(); downloadICS(entry) }}
                      title="Add to calendar"
                      style={{
                        flexShrink: 0, width: 30, height: 30, borderRadius: 6, border: 0,
                        background: 'transparent', color: 'var(--ink-faint)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <CalendarPlus size={14} strokeWidth={2} />
                    </button>
                  )}

                  {canEdit ? (
                    <button
                      onClick={e => startEdit(entry, e)}
                      title="Edit round details"
                      style={{
                        flexShrink: 0, width: 30, height: 30, borderRadius: 6, border: 0,
                        background: isEditing ? 'rgba(10,34,64,.10)' : 'transparent',
                        color: isEditing ? 'var(--tour-navy)' : 'var(--ink-faint)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {isEditing ? <X size={14} strokeWidth={2.5} /> : <Pencil size={14} strokeWidth={2} />}
                    </button>
                  ) : (status !== 'upcoming' && (session || status === 'scored')) ? (
                    <ChevronRight size={16} color="var(--ink-faint)" strokeWidth={2} />
                  ) : null}
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: 'var(--tour-navy)', padding: '14px 16px',
                      display: 'flex', flexDirection: 'column', gap: 10,
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#B9C5D9', display: 'block', marginBottom: 4 }}>
                          Date
                        </label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={e => setEditDate(e.target.value)}
                          style={{ ...inputStyle(), width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#B9C5D9', display: 'block', marginBottom: 4 }}>
                          First tee
                        </label>
                        <input
                          type="time"
                          value={editTeeTime}
                          onChange={e => setEditTeeTime(e.target.value)}
                          style={{ ...inputStyle(), width: '100%' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#B9C5D9', display: 'block', marginBottom: 4 }}>
                        Venue
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Strand GK"
                        value={editVenue}
                        onChange={e => setEditVenue(e.target.value)}
                        style={{ ...inputStyle(), width: '100%' }}
                      />
                    </div>
                    <button
                      onClick={saveEdit}
                      disabled={editSaving}
                      style={{
                        height: 38, background: editSaving ? 'rgba(200,16,46,.5)' : 'var(--tournament-red)',
                        color: '#fff', border: 0, borderRadius: 6,
                        fontWeight: 700, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase',
                        cursor: editSaving ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <Save size={13} strokeWidth={2.5} />
                      {editSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'var(--tour-navy)',
        padding: '20px 16px 16px',
        borderBottom: '2px solid var(--trophy-gold)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--trophy-gold)', marginBottom: 4 }}>
          PGA Schager
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>
          Schedule
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14 }}>Loading…</div>
      ) : rounds.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center' }}>
          <CalendarDays size={40} color="var(--ink-faint)" strokeWidth={1.5} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 6 }}>No rounds yet</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Rounds are added via Seasonal Planning</div>
        </div>
      ) : (
        <div className="md:flex md:flex-wrap md:items-start md:gap-x-6 md:gap-y-0 md:px-6">
          {upcoming.length > 0 && renderSection('Upcoming', upcoming)}
          {pending.length > 0 && renderSection('Report result', pending)}
          {past.length > 0 && renderSection('Past rounds', past)}
        </div>
      )}
    </div>
  )
}
