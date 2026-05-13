'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { ShieldCheck, ChevronLeft, Plus, ChevronRight, Pencil, Trash2, X, Check } from 'lucide-react'
import type { Round, Player, Score } from '@/lib/database.types'
import { assignPoints } from '@/lib/points'
import Link from 'next/link'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const today = new Date().toISOString().slice(0, 10)
const currentYear = new Date().getFullYear()
const prevYearEnd = `${currentYear - 1}-12-31`
const currYearStart = `${currentYear}-01-01`

interface RoundRow extends Round {
  scoreCount: number
}

function label(style: React.CSSProperties = {}): React.CSSProperties {
  return { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--ink-soft)', marginBottom: 6, ...style }
}

function textInput(style: React.CSSProperties = {}): React.CSSProperties {
  return { width: '100%', height: 44, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, ...style }
}

export default function ManageDataPage() {
  const { session, loading, isAdmin } = useAuth()
  const router = useRouter()

  const [allRounds, setAllRounds] = useState<RoundRow[]>([])
  const [players, setPlayers]     = useState<Player[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Inline edit for current-year rounds
  const [editId, setEditId]             = useState<string | null>(null)
  const [editDate, setEditDate]         = useState('')
  const [editVenue, setEditVenue]       = useState('')
  const [editSaving, setEditSaving]     = useState(false)
  const [editRoundPlayers, setEditRoundPlayers] = useState<Player[]>([])
  const [editRoundScores, setEditRoundScores]   = useState<Record<string, string>>({})
  const [editScoreSaving, setEditScoreSaving]   = useState(false)

  // Historical round form
  const [showHist, setShowHist]   = useState(false)
  const [histDate, setHistDate]   = useState('')
  const [histVenue, setHistVenue] = useState('')
  const [histScores, setHistScores] = useState<Record<string, string>>({})
  const [histSaving, setHistSaving] = useState(false)

  useEffect(() => {
    if (isAdmin) loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function loadAll() {
    setLoadingData(true)
    const [{ data: roundData }, { data: playerData }] = await Promise.all([
      db.from('rounds').select('*').order('date', { ascending: false }),
      db.from('players').select('*').order('name'),
    ])
    const typedRounds = (roundData as Round[]) ?? []
    setPlayers((playerData as Player[]) ?? [])

    if (typedRounds.length === 0) {
      setAllRounds([])
      setLoadingData(false)
      return
    }

    const { data: scoreData } = await db
      .from('scores')
      .select('round_id, strokes')
      .in('round_id', typedRounds.map(r => r.id))
      .not('strokes', 'is', null)

    const countByRound: Record<string, number> = {}
    for (const s of (scoreData ?? [])) {
      countByRound[s.round_id] = (countByRound[s.round_id] ?? 0) + 1
    }

    setAllRounds(typedRounds.map(r => ({ ...r, scoreCount: countByRound[r.id] ?? 0 })))
    setLoadingData(false)
  }

  // ── Edit current-year round metadata ──────────────────────────────────────

  async function startEdit(r: RoundRow) {
    setEditId(r.id)
    setEditDate(r.date)
    setEditVenue(r.notes ?? '')
    setEditRoundPlayers([])
    setEditRoundScores({})

    const [{ data: rpData }, { data: scoreData }] = await Promise.all([
      db.from('round_players').select('player_id, players(*)').eq('round_id', r.id),
      db.from('scores').select('*').eq('round_id', r.id),
    ])
    const rp = (rpData as { player_id: string; players: Player }[]) ?? []
    setEditRoundPlayers(rp.map(x => x.players).sort((a, b) => a.name.localeCompare(b.name)))

    const sc: Record<string, string> = {}
    for (const s of (scoreData as Score[]) ?? []) {
      if (s.strokes != null) sc[s.player_id] = String(s.strokes)
    }
    setEditRoundScores(sc)
  }

  async function saveEditScores() {
    if (!editId) return
    const entries = editRoundPlayers
      .filter(p => editRoundScores[p.id]?.trim() !== '' && editRoundScores[p.id] != null)
      .map(p => ({ playerId: p.id, strokes: parseInt(editRoundScores[p.id]) }))
      .filter(s => !isNaN(s.strokes) && s.strokes > 0)

    if (entries.length < 2) { toast.error('Enter at least 2 net scores'); return }

    setEditScoreSaving(true)
    const results = assignPoints(entries)
    const upserts = results.map(r => ({
      round_id:      editId,
      player_id:     r.playerId,
      strokes:       r.strokes,
      points_earned: r.points,
      rank:          r.rank,
    }))
    const { error } = await db.from('scores').upsert(upserts, { onConflict: 'round_id,player_id' })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Scores updated')
      setEditId(null)
      await loadAll()
    }
    setEditScoreSaving(false)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    setEditSaving(true)
    const { error } = await db.from('rounds').update({
      date:  editDate,
      notes: editVenue.trim() || null,
    }).eq('id', editId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Round updated')
      setEditId(null)
      await loadAll()
    }
    setEditSaving(false)
  }

  // ── Delete round (cascade manually) ──────────────────────────────────────

  async function deleteRound(r: RoundRow) {
    if (!confirm(`Delete the round on ${formatDate(r.date)} and all its scores? This cannot be undone.`)) return

    const { data: groupData } = await db.from('groups').select('id').eq('round_id', r.id)
    const groupIds = (groupData ?? []).map((g: { id: string }) => g.id)
    if (groupIds.length > 0) {
      await db.from('group_members').delete().in('group_id', groupIds)
    }
    await db.from('groups').delete().eq('round_id', r.id)
    await db.from('round_players').delete().eq('round_id', r.id)
    await db.from('scores').delete().eq('round_id', r.id)
    const { error } = await db.from('rounds').delete().eq('id', r.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Round deleted')
      await loadAll()
    }
  }

  // ── Add historical round ──────────────────────────────────────────────────

  async function saveHistorical(e: React.FormEvent) {
    e.preventDefault()

    const scoreInputs = players
      .filter(p => histScores[p.id]?.trim() !== '' && histScores[p.id] != null)
      .map(p => ({ playerId: p.id, strokes: parseInt(histScores[p.id]) }))
      .filter(s => !isNaN(s.strokes) && s.strokes > 0)

    if (scoreInputs.length < 2) {
      toast.error('Enter net scores for at least 2 players')
      return
    }

    setHistSaving(true)

    const { data: newRound, error: roundErr } = await db.from('rounds').insert({
      date:       histDate,
      notes:      histVenue.trim() || null,
      group_size: 4,
    }).select('id').single()

    if (roundErr) {
      toast.error(roundErr.message)
      setHistSaving(false)
      return
    }

    const results = assignPoints(scoreInputs)

    await db.from('round_players').insert(
      results.map(r => ({ round_id: newRound.id, player_id: r.playerId }))
    )

    const { error: scoreErr } = await db.from('scores').insert(
      results.map(r => ({
        round_id:      newRound.id,
        player_id:     r.playerId,
        strokes:       r.strokes,
        points_earned: r.points,
        rank:          r.rank,
      }))
    )

    if (scoreErr) {
      toast.error(scoreErr.message)
    } else {
      toast.success('Historical round saved')
      setShowHist(false)
      setHistDate('')
      setHistVenue('')
      setHistScores({})
      await loadAll()
    }
    setHistSaving(false)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function formatDate(date: string) {
    return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function DateBadge({ date }: { date: string }) {
    const d = new Date(date + 'T12:00:00')
    return (
      <div style={{ width: 44, height: 44, background: 'var(--tour-navy)', borderRadius: 8, color: '#F5EFE0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 9, letterSpacing: '.10em', fontWeight: 700 }}>
          {d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
          {d.getDate()}
        </div>
      </div>
    )
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (loading) return null
  if (!session || !isAdmin) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-soft)' }}>
        <ShieldCheck size={40} strokeWidth={1.5} style={{ margin: '0 auto 12px', color: 'var(--ink-faint)' }} />
        <p style={{ fontSize: 15 }}>Access denied.</p>
      </div>
    )
  }

  const currRounds = allRounds.filter(r => r.date >= currYearStart && r.date <= today)
  const pastRounds = allRounds.filter(r => r.date < currYearStart)

  const pastByYear: Record<number, RoundRow[]> = {}
  for (const r of pastRounds) {
    const y = new Date(r.date + 'T12:00:00').getFullYear()
    if (!pastByYear[y]) pastByYear[y] = []
    pastByYear[y].push(r)
  }
  const pastYears = Object.keys(pastByYear).map(Number).sort((a, b) => b - a)

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--bunker-sand-deep)',
    borderRadius: 12,
    boxShadow: 'var(--shadow-card)',
    overflow: 'hidden',
  }

  return (
    <div style={{ background: 'var(--bunker-sand)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ background: 'var(--tour-navy)', padding: '20px 16px 16px', borderBottom: '2px solid var(--trophy-gold)' }}>
        <button
          onClick={() => router.push('/admin')}
          style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', padding: 0, marginBottom: 10 }}
        >
          <ChevronLeft size={14} strokeWidth={2.5} /> Admin
        </button>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--trophy-gold)', marginBottom: 4 }}>Admin</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>Manage Data</div>
      </div>

      <div style={{ padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Current Season ──────────────────────────────────────────────── */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Current Season · {currentYear}</div>

          {loadingData ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14, padding: '24px 0' }}>Loading…</div>
          ) : currRounds.length === 0 ? (
            <div style={{ ...card, padding: '24px 16px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
              No rounds played this season yet.
            </div>
          ) : (
            <div style={card}>
              {currRounds.map((r, i) => (
                <div key={r.id} style={{ borderBottom: i < currRounds.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none' }}>
                  {editId === r.id ? (
                    /* Inline edit form */
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Edit Round</span>
                        <button type="button" onClick={() => setEditId(null)} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink-faint)', padding: 4 }}>
                          <X size={16} strokeWidth={2} />
                        </button>
                      </div>

                      {/* Details section */}
                      <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Round Details</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={label({ fontSize: 10 })}>Date</label>
                            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                              min={currYearStart} max={today} required style={textInput({ height: 40, fontSize: 14 })} />
                          </div>
                          <div>
                            <label style={label({ fontSize: 10 })}>Venue</label>
                            <input type="text" value={editVenue} onChange={e => setEditVenue(e.target.value)}
                              placeholder="e.g. Schager GK" style={textInput({ height: 40, fontSize: 14 })} />
                          </div>
                        </div>
                        <button type="submit" disabled={editSaving}
                          style={{ height: 38, borderRadius: 8, border: 0, background: editSaving ? '#ccc' : 'var(--tour-navy)', color: '#F5EFE0', fontWeight: 700, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', cursor: editSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <Check size={14} strokeWidth={2.5} /> {editSaving ? 'Saving…' : 'Save Details'}
                        </button>
                      </form>

                      {/* Scores section */}
                      {editRoundPlayers.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ height: 1, background: 'var(--bunker-sand-deep)' }} />
                          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Net Scores</label>
                          {editRoundPlayers.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{p.name}</span>
                              <input
                                type="number" min={40} max={130}
                                value={editRoundScores[p.id] ?? ''}
                                onChange={e => setEditRoundScores(prev => ({ ...prev, [p.id]: e.target.value }))}
                                placeholder="—"
                                style={{ width: 72, height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 15, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
                              />
                            </div>
                          ))}
                          <button onClick={saveEditScores} disabled={editScoreSaving}
                            style={{ height: 38, borderRadius: 8, border: 0, background: editScoreSaving ? '#ccc' : 'var(--fairway-green)', color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', cursor: editScoreSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Check size={14} strokeWidth={2.5} /> {editScoreSaving ? 'Saving…' : 'Save & Recalculate Points'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Normal row */
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                      <DateBadge date={r.date} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                          {new Date(r.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                          {r.notes ?? 'No venue'}
                        </div>
                      </div>
                      {r.scoreCount > 0 ? (
                        <span style={{ height: 22, padding: '0 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(31,122,76,.14)', color: 'var(--fairway-green)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>Scored</span>
                      ) : (
                        <span style={{ height: 22, padding: '0 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(10,34,64,.08)', color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>Pending</span>
                      )}
                      <button onClick={() => startEdit(r)} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--bunker-sand-deep)', background: 'transparent', color: 'var(--ink-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Pencil size={13} strokeWidth={2} />
                      </button>
                      <button onClick={() => deleteRound(r)} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--bunker-sand-deep)', background: 'transparent', color: 'var(--tournament-red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Add Historical Round ────────────────────────────────────────── */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Historical Rounds</div>

          {!showHist ? (
            <button
              onClick={() => setShowHist(true)}
              style={{ width: '100%', height: 48, borderRadius: 10, border: 0, background: 'var(--tour-navy)', color: '#F5EFE0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 14, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <Plus size={18} strokeWidth={2.5} />
              Add Historical Round
            </button>
          ) : (
            <form onSubmit={saveHistorical} style={card}>
              <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Add Historical Round</span>
                <button type="button" onClick={() => setShowHist(false)} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink-faint)', padding: 4 }}>
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Date — max is last day of previous year */}
                <div>
                  <label style={label()}>Date (previous years only) *</label>
                  <input type="date" value={histDate} onChange={e => setHistDate(e.target.value)}
                    max={prevYearEnd} required style={textInput()} />
                </div>

                {/* Venue */}
                <div>
                  <label style={label()}>Venue</label>
                  <input type="text" value={histVenue} onChange={e => setHistVenue(e.target.value)}
                    placeholder="e.g. Schager GK" style={textInput()} />
                </div>

                {/* Net scores per player */}
                <div>
                  <label style={label()}>Net Scores (leave blank to exclude a player)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {players.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{p.name}</span>
                        <input
                          type="number"
                          min={40} max={130}
                          value={histScores[p.id] ?? ''}
                          onChange={e => setHistScores(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="—"
                          style={{ width: 72, height: 40, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 15, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ padding: '0 16px 16px' }}>
                <button type="submit" disabled={histSaving || !histDate}
                  style={{ width: '100%', height: 48, borderRadius: 10, border: 0, background: histSaving || !histDate ? '#ccc' : 'var(--tour-navy)', color: '#F5EFE0', fontWeight: 700, fontSize: 14, letterSpacing: '.06em', textTransform: 'uppercase', cursor: histSaving || !histDate ? 'not-allowed' : 'pointer' }}>
                  {histSaving ? 'Saving…' : 'Save Round & Scores'}
                </button>
              </div>
            </form>
          )}

          {/* Past rounds (read-only) */}
          {!loadingData && pastYears.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pastYears.map(year => (
                <div key={year}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8 }}>{year}</div>
                  <div style={card}>
                    {pastByYear[year].map((r, i, arr) => (
                      <Link key={r.id} href={`/rounds/${r.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none', textDecoration: 'none' }}>
                        <DateBadge date={r.date} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{formatDate(r.date)}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 1 }}>{r.notes ?? 'No venue'}</div>
                        </div>
                        {r.scoreCount > 0 ? (
                          <span style={{ height: 20, padding: '0 8px', borderRadius: 999, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(31,122,76,.14)', color: 'var(--fairway-green)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{r.scoreCount} scored</span>
                        ) : (
                          <span style={{ height: 20, padding: '0 8px', borderRadius: 999, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(10,34,64,.08)', color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>Pending</span>
                        )}
                        <ChevronRight size={14} color="var(--ink-faint)" strokeWidth={2} />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
