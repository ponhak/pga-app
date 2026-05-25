'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player, Round, Score } from '@/lib/database.types'
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { NextRoundCountdown } from '@/components/NextRoundCountdown'
import { PlayerAvatar } from '@/components/PlayerAvatar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface Standing {
  player: Player
  totalPoints: number
  roundsPlayed: number
  wins: number
}

interface RecentRound {
  round: Round
  playerCount: number
  hasScores: boolean
}


function formatPts(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

function ordinal(n: number) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}

// ── Player stats panel ───────────────────────────────────────────────────────

function PlayerStatsPanel({
  player,
  standing,
  standings,
  allRounds,
  allScores,
}: {
  player: Player
  standing: Standing
  standings: Standing[]
  allRounds: Round[]
  allScores: Score[]
}) {
  const [careerScores, setCareerScores] = useState<{ rank: number | null; dnf: boolean }[] | null>(null)

  useEffect(() => {
    db.from('scores').select('rank, dnf').eq('player_id', player.id).then(({ data }: { data: { rank: number | null; dnf: boolean }[] | null }) => {
      setCareerScores(data ?? [])
    })
  }, [player.id])

  // Season stats
  const playerScores = allScores.filter(s => s.player_id === player.id && s.strokes != null)
  const ranks = playerScores.map(s => s.rank).filter((r): r is number => r != null)
  const nets  = playerScores.map(s => s.strokes).filter((s): s is number => s != null)

  const bestFinish   = ranks.length ? Math.min(...ranks) : null
  const avgFinish    = avg(ranks)
  const avgNet       = avg(nets)
  const ptsPerRound  = standing.roundsPlayed > 0 ? standing.totalPoints / standing.roundsPlayed : null

  // Chart: player's leaderboard position after each round
  const fieldSize = Math.max(standings.length, 2)
  const runningPts: Record<string, number> = {}
  standings.forEach(s => { runningPts[s.player.id] = 0 })

  const posPoints = allRounds.map(r => {
    const roundScores = allScores.filter(sc => sc.round_id === r.id)
    const hasScores = roundScores.some(sc => sc.strokes != null)
    roundScores.forEach(sc => {
      if (sc.points_earned != null)
        runningPts[sc.player_id] = (runningPts[sc.player_id] ?? 0) + Number(sc.points_earned)
    })
    if (!hasScores) return { played: false, pos: null as number | null }
    const sorted = Object.entries(runningPts).sort(([, a], [, b]) => b - a)
    const pos = sorted.findIndex(([id]) => id === player.id) + 1
    return { played: true, pos }
  })

  // Carry-forward position for context line (unplayed rounds inherit last position)
  let lastPos: number | null = null
  const chartPoints = posPoints.map(p => {
    if (p.played && p.pos != null) lastPos = p.pos
    return { played: p.played, pos: p.played ? p.pos : lastPos }
  })

  // Current standing position (last played round)
  const currentPos = posPoints.reduceRight<number | null>((acc, p) => acc ?? (p.played ? p.pos : null), null)

  // Chart geometry
  const CW = 300, CH = 160
  const LEFT = 40, RIGHT = 8, TOP = 12, BOTTOM = 20
  const chartW = CW - LEFT - RIGHT
  const chartH = CH - TOP - BOTTOM
  const sx = (i: number) => LEFT + (allRounds.length < 2 ? chartW / 2 : (i / (allRounds.length - 1)) * chartW)
  // pos=1 → top (y=TOP), pos=fieldSize → bottom (y=TOP+chartH)
  const sy = (pos: number) => TOP + ((pos - 1) / Math.max(fieldSize - 1, 1)) * chartH

  // Dashed grey context line (carry-forward so unplayed rounds show flat)
  const contextLine = chartPoints
    .map((p, i) => p.pos != null ? `${sx(i)},${sy(p.pos)}` : null)
    .filter((v): v is string => v !== null)
    .join(' ')

  // Gold solid line connecting played rounds
  const playedPolyline = posPoints
    .map((p, i) => p.played && p.pos != null ? `${sx(i)},${sy(p.pos)}` : null)
    .filter((v): v is string => v !== null)
    .join(' ')

  // Y-axis: every position 1..fieldSize
  const yAxisPositions = Array.from({ length: fieldSize }, (_, i) => i + 1)

  // Career stats (all-time including current season)
  const careerRanks = (careerScores ?? []).map(s => s.rank).filter((r): r is number => r != null)
  const careerWins      = careerRanks.filter(r => r === 1).length
  const careerBest      = careerRanks.length ? Math.min(...careerRanks) : null
  const careerAvgFinish = avg(careerRanks)

  const pill = (label: string, value: string, gold = false) => (
    <div key={label} style={{
      padding: '8px 10px',
      background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.10)',
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: gold ? 'var(--trophy-gold)' : '#F5EFE0', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: 'rgba(5,15,30,.6)' }}>
      {/*
        DOM order = mobile stack: Season → Chart → Rounds → Career
        Desktop (md) grid:
          col1/row1 = Season   col2/rows1-3 = Rounds
          col1/row2 = Chart
          col1/row3 = Career
      */}
      <div className="md:grid md:grid-cols-2">

        {/* Season — col1/row1 */}
        <div className="md:col-start-1 md:row-start-1" style={{ padding: '14px 14px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#F5EFE0', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
            {new Date().getFullYear()} Season
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {pill('Wins', `${standing.wins}`, standing.wins > 0)}
            {pill('Best finish', bestFinish != null ? ordinal(bestFinish) : '—')}
            {pill('Avg finish',  avgFinish  != null ? ordinal(Math.round(avgFinish)) : '—')}
            {pill('Avg net',     avgNet     != null ? String(Math.round(avgNet)) : '—')}
            {pill('Pts / round', ptsPerRound != null ? formatPts(Math.round(ptsPerRound * 10) / 10) : '—')}
          </div>
        </div>

        {/* Chart — col1/row2 */}
        {allRounds.length > 0 && (
          <div className="md:col-start-1 md:row-start-2" style={{ padding: '10px 14px 0' }}>
            <div style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.09)',
              borderRadius: 10,
              padding: '12px 12px 10px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)' }}>
                  Season Standings
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--trophy-gold)', lineHeight: 1 }}>
                  {currentPos != null ? ordinal(currentPos) : '—'}
                </span>
              </div>
              <svg viewBox={`0 0 ${CW} ${CH}`} width="100%"
                   style={{ display: 'block', overflow: 'visible' }}>
                {yAxisPositions.map((pos) => (
                  <g key={pos}>
                    <line x1={LEFT} y1={sy(pos)} x2={CW - RIGHT} y2={sy(pos)}
                      stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeDasharray={pos === 1 ? 'none' : '3 5'} />
                    <text x={LEFT - 10} y={sy(pos) + 3.5} textAnchor="end"
                      style={{ fontSize: 8, fill: 'rgba(255,255,255,.35)', fontFamily: 'monospace' }}>
                      {ordinal(pos)}
                    </text>
                  </g>
                ))}
                {contextLine && (
                  <polyline points={contextLine}
                    fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.5" strokeDasharray="3 5" />
                )}
                {playedPolyline && (
                  <polyline points={playedPolyline} fill="none" stroke="var(--trophy-gold)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                )}
                {posPoints.map((p, i) => p.played && p.pos != null && (
                  <circle key={i} cx={sx(i)} cy={sy(p.pos)}
                    r={i === posPoints.length - 1 ? 4.5 : 3}
                    fill="var(--trophy-gold)" />
                ))}
                {allRounds.map((_, i) => (
                  <text key={i} x={sx(i)} y={CH} textAnchor="middle"
                    style={{ fontSize: 8, fill: 'rgba(255,255,255,.35)', fontFamily: 'monospace' }}>
                    {`R${i + 1}`}
                  </text>
                ))}
              </svg>
            </div>
          </div>
        )}

        {/* Rounds — col2/rows1-3 */}
        <div className="md:col-start-2 md:row-start-1 md:row-span-3"
             style={{ padding: '10px 14px 0', borderLeft: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px 44px 44px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 2 }}>
            {['Date', 'Rank', 'Net', '+/−', 'Pts'].map((h, i) => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', textAlign: i > 0 ? 'center' : 'left' }}>
                {h}
              </span>
            ))}
          </div>
          {allRounds.map((r, i) => {
            const sc = allScores.find(s => s.round_id === r.id && s.player_id === player.id)
            const played = sc && sc.strokes != null
            const isDnf  = sc?.dnf === true
            const d = new Date(r.date + 'T12:00:00')
            const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            const diffColor = sc?.net_diff == null ? 'rgba(255,255,255,.30)'
              : sc.net_diff < 0 ? 'var(--tournament-red)' : '#F5EFE0'
            return (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 44px 44px 44px 44px',
                alignItems: 'center', padding: '7px 0',
                borderBottom: i < allRounds.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                opacity: played || isDnf ? 1 : 0.38,
              }}>
                <div>
                  <span style={{ fontSize: 12, color: '#F5EFE0', fontWeight: 500 }}>{dateStr}</span>
                  {r.double_points && <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--trophy-gold)' }}>⚡</span>}
                  {r.notes && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.40)', marginTop: 1 }}>{r.notes}</div>}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textAlign: 'center',
                  color: isDnf ? 'var(--tournament-red)' : played ? '#F5EFE0' : 'rgba(255,255,255,.30)' }}>
                  {isDnf ? 'DNF' : played ? ordinal(sc!.rank!) : '—'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'center', color: played ? '#F5EFE0' : 'rgba(255,255,255,.30)' }}>
                  {played ? sc!.strokes : '—'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textAlign: 'center', color: played ? diffColor : 'rgba(255,255,255,.30)' }}>
                  {played && sc!.net_diff != null ? (sc!.net_diff > 0 ? `+${sc!.net_diff}` : String(sc!.net_diff)) : '—'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textAlign: 'center', color: played ? 'var(--trophy-gold)' : 'rgba(255,255,255,.30)' }}>
                  {played ? formatPts(Number(sc!.points_earned)) : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Career — col1/row3 (last in DOM = last on mobile) */}
        <div className="md:col-start-1 md:row-start-3" style={{ padding: '14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#F5EFE0', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
            Career
          </div>
          {careerScores === null ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.30)' }}>Loading…</div>
          ) : careerRanks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.30)' }}>First season — no prior data</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Career Wins', value: String(careerWins),    gold: careerWins > 0 },
                { label: 'Career Best', value: careerBest != null ? ordinal(careerBest) : '—', gold: careerBest === 1 },
                { label: 'Career Avg',  value: careerAvgFinish != null ? ordinal(Math.round(careerAvgFinish)) : '—', gold: false },
              ].map(({ label, value, gold }) => (
                <div key={label} style={{
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)',
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 3 }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: gold ? 'var(--trophy-gold)' : '#F5EFE0', lineHeight: 1 }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [standings, setStandings] = useState<Standing[]>([])
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([])
  const [allRounds, setAllRounds] = useState<Round[]>([])
  const [allScores, setAllScores] = useState<Score[]>([])
  const [todayRound, setTodayRound] = useState<Round | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const currentYear = new Date().getFullYear()
    const yearStart = `${currentYear}-01-01`
    const yearEnd   = `${currentYear}-12-31`

    const [{ data: players }, { data: rounds }, { data: roundPlayers }] =
      await Promise.all([
        db.from('players').select('*'),
        db.from('rounds').select('*').gte('date', yearStart).lte('date', yearEnd).order('date', { ascending: false }),
        db.from('round_players').select('round_id, player_id'),
      ])

    const typedPlayers = (players as Player[]) ?? []
    const typedRounds  = (rounds as Round[]) ?? []
    const typedRP      = (roundPlayers as { round_id: string; player_id: string }[]) ?? []

    const roundIds = typedRounds.map(r => r.id)
    const { data: scores } = roundIds.length > 0
      ? await db.from('scores').select('*').in('round_id', roundIds)
      : { data: [] }

    const typedScores = (scores as Score[]) ?? []

    const standingMap: Record<string, Standing> = {}
    typedPlayers.forEach((p) => {
      standingMap[p.id] = { player: p, totalPoints: 0, roundsPlayed: 0, wins: 0 }
    })

    const scoresByRound: Record<string, Score[]> = {}
    typedScores.forEach((s) => {
      if (!scoresByRound[s.round_id]) scoresByRound[s.round_id] = []
      scoresByRound[s.round_id].push(s)
    })

    typedScores.forEach((s) => {
      if (standingMap[s.player_id] && s.points_earned != null) {
        standingMap[s.player_id].totalPoints += Number(s.points_earned)
        standingMap[s.player_id].roundsPlayed += 1
        if (s.rank === 1) standingMap[s.player_id].wins += 1
      }
    })

    const sorted = Object.values(standingMap)
      .sort((a, b) =>
        b.totalPoints - a.totalPoints ||
        (a.player.hcp ?? 999) - (b.player.hcp ?? 999) ||
        a.player.name.localeCompare(b.player.name)
      )
    setStandings(sorted)
    setAllRounds([...typedRounds].sort((a, b) => a.date.localeCompare(b.date)))
    setAllScores(typedScores)

    const rpByRound: Record<string, number> = {}
    typedRP.forEach((rp) => {
      rpByRound[rp.round_id] = (rpByRound[rp.round_id] ?? 0) + 1
    })

    const todayStr = new Date().toISOString().slice(0, 10)
    const found = typedRounds.find(
      r => r.date === todayStr && !(scoresByRound[r.id] ?? []).some(s => s.strokes != null)
    )
    setTodayRound(found ?? null)

    setRecentRounds(typedRounds.map((r) => ({
      round: r,
      playerCount: rpByRound[r.id] ?? 0,
      hasScores: (scoresByRound[r.id] ?? []).some((s) => s.strokes != null),
    })))

    setLoading(false)
  }

  const leader = standings[0]
  const hasData    = standings.some(s => s.totalPoints > 0)
  const hasStarted = hasData

  return (
    <div style={{ background: 'var(--bunker-sand)' }}>
      {/* ── Hero ── */}
      <section
        className="bg-dimple hero-top-pad"
        style={{
          background: 'var(--tour-navy)',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Status row */}
        <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 28, padding: '0 12px', borderRadius: 999,
            fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase',
            background: hasStarted ? 'var(--tournament-red)' : 'rgba(255,255,255,.10)',
            color: '#fff',
          }}>
            {hasStarted && <span style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%', display: 'inline-block' }} />}
            {hasStarted ? 'Season Live' : 'Pre-Season'}
          </span>
          <span style={{ fontSize: 11, letterSpacing: '.12em', color: '#B9C5D9', fontWeight: 700, textTransform: 'uppercase' }}>
            {new Date().getFullYear()}
          </span>
        </div>

        {/* Leader hero card */}
        {leader && hasData && (
          <>
            <div style={{ position: 'relative', height: 280, background: 'var(--tour-navy)' }}>

              {/* Owl torso — not clipped, bleeds outside card on desktop */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/owl-torso.png"
                alt=""
                aria-hidden
                style={{
                  position: 'absolute', left: '-25%', top: '50%', transform: 'translateY(-50%)',
                  height: '130%', width: 'auto', maxWidth: 'none',
                  opacity: 0.12, pointerEvents: 'none', zIndex: 0,
                }}
              />

              {/* Trophy — not clipped, bleeds outside card on desktop */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/owl-trophy.png"
                alt="Trophy"
                style={{
                  position: 'absolute', right: '-12%', bottom: '-6%',
                  height: '106%', width: 'auto',
                  opacity: 0.12, pointerEvents: 'none', zIndex: 0,
                }}
              />

              {/* Clipping wrapper — player photo + gradient only */}
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 1 }}>
                {leader.player.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leader.player.avatar_url}
                    alt={leader.player.name}
                    style={{
                      position: 'absolute', left: '50%', top: 0,
                      transform: 'translateX(-50%)',
                      height: '100%', width: '56%',
                      objectFit: 'cover', objectPosition: 'top center',
                    }}
                  />
                ) : (
                  <div style={{
                    position: 'absolute', left: '50%', top: 0,
                    transform: 'translateX(-50%)',
                    height: '100%', width: '56%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontSize: 120, fontWeight: 700,
                    color: 'rgba(255,255,255,.08)', lineHeight: 1, userSelect: 'none',
                  }}>
                    {leader.player.name[0].toUpperCase()}
                  </div>
                )}

                {/* Bottom gradient */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
                  background: 'linear-gradient(to top, rgba(10,34,64,.75) 0%, transparent 100%)',
                  pointerEvents: 'none',
                }} />
              </div>

              {/* Stat boxes — on top of everything */}
              <div style={{
                position: 'absolute', bottom: 8, left: 12, right: 12, zIndex: 2,
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              }}>
                {([
                  { label: 'Position', value: '1st' },
                  { label: 'Season Points', value: `${formatPts(leader.totalPoints)} pts` },
                ] as const).map(({ label, value }) => (
                  <div key={label} style={{
                    padding: '8px 14px 10px',
                    background: 'rgba(5,18,35,.82)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,.14)',
                    borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 3 }}>
                      {label}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '8px 16px 20px', textAlign: 'right' }}>
              <a
                href="#leaderboard"
                style={{
                  fontSize: 12, fontWeight: 600, color: 'rgba(245,239,224,.55)',
                  letterSpacing: '.04em', textDecoration: 'none',
                }}
              >
                Full leaderboard ↓
              </a>
            </div>
          </>
        )}
        </div>
      </section>

      {/* ── Round today banner ── */}
      {todayRound && (
        <div
          onClick={() => router.push(`/rounds/${todayRound.id}`)}
          style={{
            background: 'var(--tournament-red)',
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.70)', marginBottom: 2 }}>
              Today
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff' }}>
              Round Day — Open Scorecard
            </div>
          </div>
          <ChevronRight size={20} color="rgba(255,255,255,.80)" strokeWidth={2.5} />
        </div>
      )}

      {/* ── Next round countdown ── */}
      <NextRoundCountdown playerCount={standings.length} />

      {/* ── Leaderboard (broadcast style) ── */}
      <section id="leaderboard" style={{ background: 'var(--tour-navy)', marginTop: 15, scrollMarginTop: 56 }}>
        {/* Sub-header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--tour-navy-deep)',
          borderBottom: '1px solid rgba(255,255,255,.06)',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, textTransform: 'uppercase', letterSpacing: '.04em', color: '#F5EFE0' }}>
            Leaderboard
          </span>
          {hasStarted ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', background: 'var(--tournament-red)', color: '#fff' }}>
              <span style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%', display: 'inline-block' }} />
              Live
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', background: 'rgba(255,255,255,.08)', color: '#8895AC' }}>
              Not started
            </span>
          )}
        </div>

        {/* Column header */}
        <div className="broadcast-header" style={{
          display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px 28px',
          alignItems: 'center', height: 30, padding: '0 14px',
        }}>
          <span>POS</span>
          <span>PLAYER</span>
          <span style={{ textAlign: 'right' }}>ROUNDS</span>
          <span style={{ textAlign: 'right' }}>POINTS</span>
          <span />
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: '24px 14px', color: '#8895AC', fontSize: 13, textAlign: 'center' }}>Loading…</div>
        ) : standings.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#8895AC', fontSize: 14 }}>
            No players yet.{' '}
            <Link href="/players" style={{ color: 'var(--trophy-gold)', fontWeight: 700, textDecoration: 'none' }}>Add players</Link>
            {' '}to get started.
          </div>
        ) : (
          <div>
            {standings.map((s, i) => {
              const isLeader  = i === 0 && hasData
              const isExpanded = expandedId === s.player.id
              const rowBg = isExpanded ? 'rgba(201,162,74,.10)' : isLeader ? 'rgba(201,162,74,.15)' : 'transparent'
              return (
                <div key={s.player.id}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : s.player.id)}
                    style={{
                      display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px 28px',
                      alignItems: 'center', height: 52,
                      paddingLeft: 0, paddingRight: 14, paddingTop: 0, paddingBottom: 0,
                      background: rowBg, color: '#F5EFE0',
                      borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,.06)',
                      borderLeft: isExpanded ? '3px solid var(--trophy-gold)' : '3px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: isLeader || isExpanded ? 'var(--trophy-gold)' : '#B9C5D9', paddingLeft: 11 }}>
                      {i + 1}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <PlayerAvatar name={s.player.name} avatarUrl={s.player.avatar_url} size={28} gold={isLeader || isExpanded} />
                      <span style={{ fontWeight: 500, fontSize: 15, color: isExpanded ? 'var(--trophy-gold)' : '#F5EFE0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.player.name}
                      </span>
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#B9C5D9', textAlign: 'right' }}>
                      {s.roundsPlayed}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, textAlign: 'right', color: isLeader ? 'var(--trophy-gold)' : (s.totalPoints > 0 ? '#F5EFE0' : '#8895AC') }}>
                      {formatPts(s.totalPoints)}
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'center', color: '#8895AC' }}>
                      {isExpanded ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
                    </span>
                  </div>
                  {isExpanded && (
                    <PlayerStatsPanel player={s.player} standing={s} standings={standings} allRounds={allRounds} allScores={allScores} />
                  )}
                </div>
              )
            })}
          </div>
        )}

      </section>

      {/* ── Recent rounds ── */}
      {recentRounds.filter(r => r.hasScores).length > 0 && (
        <section style={{ padding: '20px 16px 24px', background: 'var(--bunker-sand)' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Recent rounds</div>
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--bunker-sand-deep)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
            }}
          >
            {recentRounds.filter(r => r.hasScores).map(({ round, playerCount, hasScores }, i, arr) => (
              <Link
                key={round.id}
                href={`/rounds/${round.id}`}
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
                    {new Date(round.date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                    {new Date(round.date + 'T12:00:00').getDate()}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink)', letterSpacing: '.02em' }}>
                    {new Date(round.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {playerCount} player{playerCount !== 1 ? 's' : ''}
                  </div>
                </div>
                {hasScores ? (
                  <span style={{
                    height: 22, padding: '0 9px', borderRadius: 999,
                    fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                    background: 'rgba(31,122,76,.14)', color: 'var(--fairway-green)',
                    display: 'flex', alignItems: 'center',
                  }}>Scored</span>
                ) : (
                  <span style={{
                    height: 22, padding: '0 9px', borderRadius: 999,
                    fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                    background: 'rgba(10,34,64,.08)', color: 'var(--ink-soft)',
                    display: 'flex', alignItems: 'center',
                  }}>Pending</span>
                )}
                <ChevronRight size={16} color="var(--ink-faint)" strokeWidth={2} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
