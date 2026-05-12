'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { assignPoints, randomizeGroups } from '@/lib/points'
import type { Player, Round, Score } from '@/lib/database.types'
import { toast } from 'sonner'
import { ChevronLeft, Save, ScanLine, Loader2, Shuffle, ChevronRight } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ── Scorecard OCR helpers ────────────────────────────────────────────────────

// App nickname → GolfGameBook real first names
const NICKNAMES: Record<string, string[]> = {
  bulan: ['kristoffer'],
  champ: ['nicklas'],
  hasse: ['hans'],
  nygren: ['niclas'],
}

function parseGolfGameBook(ocrText: string): { name: string; strokes: number }[] {
  const results: { name: string; strokes: number }[] = []
  for (const raw of ocrText.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (/^hcp\s/i.test(line) || /handicaprond/i.test(line)) continue
    // Rank prefix: "1 ", "1. ", "1) " — all optional
    const rankPrefix = /^(?:\d+[\.\)]?\s+)?/
    const name = /([A-Za-zÅÄÖåäöÉéÜü\s\-]{4,}?)/
    const score = /(\d{2,3})/
    const m = line.match(new RegExp(rankPrefix.source + name.source + /\s{2,}/.source + score.source + /\s+[+\-]/.source))
      ?? line.match(new RegExp(rankPrefix.source + name.source + /\s+/.source + score.source + /\s+[+\-]/.source))
      ?? line.match(new RegExp(rankPrefix.source + name.source + /\s{2,}/.source + score.source + /(?:\s|$)/.source))
      ?? line.match(new RegExp(rankPrefix.source + name.source + /\s+/.source + score.source + /(?:\s|$)/.source))
    if (!m) continue
    const strokes = Number(m[2])
    if (strokes < 55 || strokes > 160) continue
    results.push({ name: m[1].trim(), strokes })
  }
  return results
}

function matchScorecardName(scorecardName: string, playerNames: string[]): string | null {
  // Check every word in the scorecard name against every word in each player name
  const scWords = scorecardName.toLowerCase().split(/\s+/)
  for (const pName of playerNames) {
    const pWords = pName.toLowerCase().split(/\s+/)
    for (const sc of scWords) {
      for (const pw of pWords) {
        if (sc === pw) return pName
        if ((NICKNAMES[pw] ?? []).includes(sc)) return pName
        if ((NICKNAMES[sc] ?? []).includes(pw)) return pName
      }
    }
  }
  return null
}

interface GroupWithMembers {
  id: string
  group_number: number
  members: Player[]
}

function Avatar({ initials, size = 28 }: { initials: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--tour-navy)', color: '#F5EFE0',
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: size * 0.42, letterSpacing: '.04em',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {initials}
    </div>
  )
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function RoundPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { session } = useAuth()

  // Round + score entry state
  const [round, setRound] = useState<Round | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [groups, setGroups] = useState<GroupWithMembers[]>([])
  const [scores, setScores] = useState<Record<string, string>>({})
  const [savedScores, setSavedScores] = useState<Score[]>([])
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Setup (pre-start) state
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [setupSelected, setSetupSelected] = useState<Set<string>>(new Set())
  const [setupGroupSize, setSetupGroupSize] = useState(4)
  const [setupGroups, setSetupGroups] = useState<string[][]>([])
  const [starting, setStarting] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => { loadRound() }, [id])

  async function loadRound() {
    const [
      { data: roundData },
      { data: rpData },
      { data: grpData },
      { data: scoreData },
      { data: allPlayersData },
    ] = await Promise.all([
      db.from('rounds').select('*').eq('id', id).single(),
      db.from('round_players').select('player_id, players(*)').eq('round_id', id),
      db.from('groups').select('id, group_number, group_members(player_id, players(*))').eq('round_id', id).order('group_number'),
      db.from('scores').select('*').eq('round_id', id),
      db.from('players').select('*').order('name'),
    ])

    if (roundData) setRound(roundData as Round)

    const loadedPlayers: Player[] = rpData
      ? (rpData as { player_id: string; players: Player }[]).map(r => r.players).sort((a, b) => a.name.localeCompare(b.name))
      : []
    setPlayers(loadedPlayers)

    if (grpData) {
      const mapped: GroupWithMembers[] = (grpData as {
        id: string
        group_number: number
        group_members: { player_id: string; players: Player }[]
      }[]).map(g => ({
        id: g.id,
        group_number: g.group_number,
        members: g.group_members.map(m => m.players),
      }))
      setGroups(mapped)
    }

    if (scoreData) {
      const typed = scoreData as Score[]
      setSavedScores(typed)
      const existing: Record<string, string> = {}
      typed.forEach(s => { if (s.strokes != null) existing[s.player_id] = String(s.strokes) })
      setScores(prev => ({ ...prev, ...existing }))
    }

    const ap = (allPlayersData ?? []) as Player[]
    setAllPlayers(ap)

    // Pre-select all players in setup mode if no players assigned yet
    if (loadedPlayers.length === 0) {
      setSetupSelected(new Set(ap.map(p => p.id)))
    }

    setDataLoaded(true)
  }

  // ── Setup (pre-start) handlers ───────────────────────────────────────────

  function toggleSetupPlayer(pid: string) {
    setSetupSelected(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
    setSetupGroups([])
  }

  function setupSelectAll() {
    setSetupSelected(new Set(allPlayers.map(p => p.id)))
    setSetupGroups([])
  }

  function doSetupRandomize() {
    if (setupSelected.size < 2) { toast.error('Select at least 2 players'); return }
    setSetupGroups(randomizeGroups(Array.from(setupSelected), setupGroupSize))
  }

  function nameOf(pid: string) {
    return allPlayers.find(p => p.id === pid)?.name ?? pid
  }

  async function startRound() {
    if (setupSelected.size < 2) { toast.error('Select at least 2 players'); return }
    setStarting(true)
    try {
      await db.from('round_players').insert(
        Array.from(setupSelected).map(pid => ({ round_id: id, player_id: pid }))
      )

      if (setupGroups.length > 0) {
        for (let i = 0; i < setupGroups.length; i++) {
          const { data: grp } = await db
            .from('groups')
            .insert({ round_id: id, group_number: i + 1 })
            .select()
            .single()
          if (grp) {
            await db.from('group_members').insert(
              setupGroups[i].map((pid: string) => ({ group_id: grp.id, player_id: pid }))
            )
          }
        }
      }

      toast.success('Round started!')
      await loadRound()
    } catch {
      toast.error('Failed to start round')
    }
    setStarting(false)
  }

  // ── Score entry handlers ─────────────────────────────────────────────────

  async function saveScores() {
    const entries = Object.entries(scores)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)))
      .map(([playerId, v]) => ({ playerId, strokes: Number(v) }))

    if (entries.length === 0) { toast.error('Enter at least one score'); return }

    if (entries.length < players.length) {
      const missingCount = players.length - entries.length
      if (!confirm(`${missingCount} player(s) have no score. Save anyway?`)) return
    }

    setSaving(true)
    try {
      const results = assignPoints(entries)
      const upserts = results.map(r => ({
        round_id: id,
        player_id: r.playerId,
        strokes: r.strokes,
        points_earned: r.points,
        rank: r.rank,
      }))

      const { error } = await db.from('scores').upsert(upserts, { onConflict: 'round_id,player_id' })
      if (error) throw error

      toast.success('Scores saved!')
      await loadRound()
    } catch {
      toast.error('Failed to save scores')
    }
    setSaving(false)
  }

  async function handleScanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setScanning(true)
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      const { data: { text } } = await worker.recognize(dataUrl)
      await worker.terminate()

      const extracted = parseGolfGameBook(text)
      // Debug: keep raw OCR lines for error reporting
      const ocrLines = text.split('\n').map(l => l.trim()).filter(Boolean)
      const playerNames = players.map(p => p.name)

      const matched: Record<string, string> = {}
      let count = 0
      for (const { name, strokes } of extracted) {
        const playerName = matchScorecardName(name, playerNames)
        if (!playerName) continue
        const player = players.find(p => p.name === playerName)
        if (player && !matched[player.id]) {
          matched[player.id] = String(strokes)
          count++
        }
      }

      if (count === 0) {
        const found = extracted.map(e => e.name).join(', ')
        const rawPreview = ocrLines.slice(0, 6).join(' / ')
        toast.error(
          found
            ? `No names matched. Extracted: ${found}`
            : `Nothing parsed. OCR read: "${rawPreview}"`,
          { duration: 12000 }
        )
      } else {
        setScores(prev => ({ ...prev, ...matched }))
        toast.success(`Filled ${count} of ${players.length} scores from scorecard`)
      }
    } catch (err) {
      toast.error('Scan failed: ' + (err instanceof Error ? err.message : String(err)))
    }
    setScanning(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (!dataLoaded || !round) return (
    <div style={{ padding: 24, color: 'var(--ink-soft)', fontSize: 14, textAlign: 'center' }}>Loading…</div>
  )

  const roundDate = new Date(round.date + 'T12:00:00')
  const dateLabel = roundDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
  const weekday = roundDate.toLocaleDateString('en-GB', { weekday: 'long' })

  // ── Setup view (round has no players yet) ────────────────────────────────
  if (players.length === 0) {
    const setupPlayerList = allPlayers.filter(p => setupSelected.has(p.id))
    const startDisabled = starting || setupSelected.size < 2

    return (
      <div style={{ background: 'var(--bunker-sand)', minHeight: '100%' }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          background: 'var(--tour-navy-deep)',
          borderBottom: '2px solid var(--trophy-gold)',
        }}>
          <button
            onClick={() => router.push('/schedule')}
            style={{
              background: 'transparent', border: 0, color: '#B9C5D9',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-body)', fontWeight: 700,
              fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase',
              padding: 0, marginBottom: 12,
            }}
          >
            <ChevronLeft size={16} strokeWidth={2} />
            Schedule
          </button>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24,
            textTransform: 'uppercase', letterSpacing: '.02em', color: '#F5EFE0',
          }}>
            {weekday}
          </div>
          <div style={{ fontSize: 13, color: '#B9C5D9', marginTop: 4 }}>
            {dateLabel} · Select field · Randomize groups
          </div>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Player selection */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--bunker-sand-deep)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid var(--bunker-sand-deep)',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink)',
              }}>
                Select Field
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  height: 20, padding: '0 8px', borderRadius: 999,
                  fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
                  background: 'rgba(10,34,64,.10)', color: 'var(--ink-soft)',
                  display: 'flex', alignItems: 'center',
                }}>
                  {setupSelected.size} selected
                </span>
                <button
                  onClick={setupSelectAll}
                  style={{
                    height: 28, padding: '0 10px', borderRadius: 6,
                    border: '1px solid var(--bunker-sand-deep)',
                    background: 'transparent', color: 'var(--ink-soft)',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11,
                    letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >
                  All
                </button>
              </div>
            </div>

            {allPlayers.length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: 14, color: 'var(--ink-soft)' }}>
                No players yet.{' '}
                <a href="/players" style={{ color: 'var(--tour-navy)', fontWeight: 700, textDecoration: 'underline' }}>Add players first.</a>
              </div>
            ) : (
              <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {allPlayers.map(p => {
                  const on = setupSelected.has(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleSetupPlayer(p.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 8,
                        border: `2px solid ${on ? 'var(--tour-navy)' : 'var(--bunker-sand-deep)'}`,
                        background: on ? 'rgba(10,34,64,.06)' : '#fff',
                        color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${on ? 'var(--tour-navy)' : '#ccc'}`,
                        background: on ? 'var(--tour-navy)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {on && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Group randomizer */}
          <div style={{
            background: '#fff',
            border: '1px solid var(--bunker-sand-deep)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--bunker-sand-deep)',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
              textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink)',
            }}>
              Group Randomizer
            </div>

            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Per group:
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => { setSetupGroupSize(n); setSetupGroups([]) }}
                      style={{
                        width: 40, height: 40, borderRadius: 8, border: 0,
                        background: setupGroupSize === n ? 'var(--tour-navy)' : 'var(--bunker-sand)',
                        color: setupGroupSize === n ? '#F5EFE0' : 'var(--ink)',
                        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                        cursor: 'pointer',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={doSetupRandomize}
                style={{
                  height: 44, borderRadius: 8, border: '1.5px solid var(--tour-navy)',
                  background: 'transparent', color: 'var(--tour-navy)',
                  fontFamily: 'var(--font-body)', fontWeight: 700,
                  fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Shuffle size={16} strokeWidth={2} />
                Randomize Groups
              </button>

              {setupGroups.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                  {setupGroups.map((group, i) => (
                    <div
                      key={i}
                      style={{
                        borderRadius: 8,
                        border: '2px solid rgba(201,162,74,.40)',
                        background: 'rgba(201,162,74,.06)',
                        padding: 10,
                      }}
                    >
                      <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '.12em',
                        textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8,
                      }}>
                        Group {i + 1}
                      </div>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {group.map(pid => (
                          <li key={pid} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Avatar initials={getInitials(nameOf(pid))} size={22} />
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{nameOf(pid)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {setupPlayerList.length > 0 && setupPlayerList.length % setupGroupSize !== 0 && (
                <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>
                  Note: {setupPlayerList.length} players doesn&apos;t divide evenly into groups of {setupGroupSize} — the last group will be smaller.
                </p>
              )}
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={startRound}
            disabled={startDisabled}
            style={{
              height: 52, borderRadius: 10, border: 0,
              background: startDisabled ? '#ccc' : 'var(--tournament-red)',
              color: startDisabled ? '#999' : '#fff',
              fontFamily: 'var(--font-body)', fontWeight: 700,
              fontSize: 15, letterSpacing: '.06em', textTransform: 'uppercase',
              cursor: startDisabled ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {starting ? 'Starting…' : `Start Round · ${setupSelected.size} players`}
            {!starting && setupSelected.size >= 2 && <ChevronRight size={18} strokeWidth={2} />}
          </button>

        </div>
      </div>
    )
  }

  // ── Score entry view ─────────────────────────────────────────────────────

  const isScored = savedScores.some(s => s.strokes != null)
  const sortedScores = [...savedScores].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))

  return (
    <div style={{ background: 'var(--bunker-sand)', minHeight: '100%' }}>
      {/* Back bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px',
        background: 'var(--tour-navy-deep)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'transparent', border: 0, color: '#F5EFE0',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-body)', fontWeight: 700,
            fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase',
          }}
        >
          <ChevronLeft size={18} strokeWidth={2} />
          Board
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
            textTransform: 'uppercase', letterSpacing: '.04em', color: '#F5EFE0',
          }}>
            {dateLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            height: 20, padding: '0 8px', borderRadius: 999,
            fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
            background: isScored ? 'rgba(31,122,76,.25)' : 'rgba(255,255,255,.10)',
            color: isScored ? 'var(--fairway-green)' : '#B9C5D9',
            display: 'flex', alignItems: 'center',
          }}>
            {players.length} players
          </span>
          {isScored && (
            <span style={{
              height: 20, padding: '0 8px', borderRadius: 999,
              fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
              background: 'rgba(31,122,76,.25)', color: 'var(--fairway-green)',
              display: 'flex', alignItems: 'center',
            }}>Scored</span>
          )}
        </div>
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <section style={{ padding: '16px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Pairings</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {groups.map(g => (
              <div
                key={g.id}
                style={{
                  background: '#fff',
                  border: '1px solid var(--bunker-sand-deep)',
                  borderRadius: 12, padding: 12,
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.12em',
                  textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 8,
                }}>
                  Group {g.group_number}
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {g.members.map(m => (
                    <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar initials={getInitials(m.name)} size={24} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{m.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Score entry */}
      <section style={{ padding: '0 16px 16px' }}>
        <div style={{
          background: '#fff',
          border: '1px solid var(--bunker-sand-deep)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px',
            borderBottom: '1px solid var(--bunker-sand-deep)',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink)',
            }}>
              Scores (strokes)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isScored && (
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Edit and save to update</span>
              )}
              {session && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={scanning}
                    title="Scan scorecard photo"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      height: 30, padding: '0 10px', borderRadius: 6, border: 0,
                      background: scanning ? 'rgba(10,34,64,.06)' : 'var(--tour-navy)',
                      color: scanning ? 'var(--ink-soft)' : '#F5EFE0',
                      fontWeight: 700, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
                      cursor: scanning ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {scanning
                      ? <><Loader2 size={13} strokeWidth={2.5} style={{ animation: 'spin 1s linear infinite' }} /> Scanning…</>
                      : <><ScanLine size={13} strokeWidth={2.5} /> Scan Card</>
                    }
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleScanUpload}
                  />
                </>
              )}
            </div>
          </div>

          {players.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                borderBottom: i < players.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none',
              }}
            >
              <Avatar initials={getInitials(p.name)} size={28} />
              <label style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{p.name}</label>
              <input
                type="number"
                min={30}
                max={150}
                placeholder="—"
                value={scores[p.id] ?? ''}
                onChange={e => session && setScores(prev => ({ ...prev, [p.id]: e.target.value }))}
                readOnly={!session}
                style={{
                  width: 72, height: 36, textAlign: 'center',
                  borderRadius: 6, border: '1.5px solid var(--bunker-sand-deep)',
                  background: scores[p.id] ? 'var(--tour-navy)' : 'var(--bunker-sand)',
                  color: scores[p.id] ? '#F5EFE0' : 'var(--ink)',
                  fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 15,
                  outline: 'none', boxSizing: 'border-box',
                  cursor: session ? 'auto' : 'default',
                }}
              />
            </div>
          ))}

          {session && (
            <div style={{ padding: '12px 14px' }}>
              <button
                onClick={saveScores}
                disabled={saving}
                style={{
                  width: '100%', height: 46,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderRadius: 8, border: 0,
                  background: saving ? '#ccc' : 'var(--tour-navy)',
                  color: saving ? '#666' : '#F5EFE0',
                  fontFamily: 'var(--font-body)', fontWeight: 700,
                  fontSize: 14, letterSpacing: '.06em', textTransform: 'uppercase',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                <Save size={16} strokeWidth={2} />
                {saving ? 'Saving…' : 'Save Scores & Calculate Points'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      {isScored && sortedScores.length > 0 && (
        <section style={{ background: 'var(--tour-navy)', paddingBottom: 8 }}>
          <div className="broadcast-header" style={{
            display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px',
            alignItems: 'center', height: 30, padding: '0 14px',
          }}>
            <span>POS</span>
            <span>PLAYER</span>
            <span style={{ textAlign: 'right' }}>STROKES</span>
            <span style={{ textAlign: 'right' }}>POINTS</span>
          </div>

          {sortedScores.map((s, i) => {
            const player = players.find(p => p.id === s.player_id)
            const isFirst = s.rank === 1
            const isSecond = s.rank === 2
            const isThird = s.rank === 3
            return (
              <div
                key={s.id}
                style={{
                  display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px',
                  alignItems: 'center', height: 52, padding: '0 14px',
                  background: isFirst ? 'rgba(201,162,74,.15)' : 'transparent',
                  color: '#F5EFE0',
                  borderBottom: i < sortedScores.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none',
                }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
                  background: isFirst ? 'var(--trophy-gold)' : isSecond ? 'rgba(255,255,255,.15)' : isThird ? 'rgba(201,100,30,.3)' : 'transparent',
                  color: isFirst ? 'var(--tour-navy)' : '#B9C5D9',
                }}>
                  {s.rank}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Avatar initials={player ? getInitials(player.name) : '?'} size={28} />
                  <span style={{ fontWeight: 500, fontSize: 15, color: '#F5EFE0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player?.name}
                  </span>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: '#B9C5D9', textAlign: 'right' }}>
                  {s.strokes}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18,
                  textAlign: 'right',
                  color: isFirst ? 'var(--trophy-gold)' : '#F5EFE0',
                }}>
                  {s.points_earned != null
                    ? (Number(s.points_earned) % 1 === 0 ? s.points_earned : Number(s.points_earned).toFixed(1))
                    : '—'}
                </span>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
