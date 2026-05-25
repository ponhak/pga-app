'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Player, Round, Score } from '@/lib/database.types'
import { PlayerAvatar } from '@/components/PlayerAvatar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface Standing {
  rank: number
  player: Player
  points: number
  rounds: number
  wins: number
}

interface Season {
  year: number
  rounds: Round[]
  scores: Score[]
  standings: Standing[]
}

function fmt(n: number) {
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

// ── History stats panel (shown when a leaderboard row is expanded) ────────────

function HistoryStatsPanel({
  player,
  standing,
  seasonStandings,
  seasonRounds,
  seasonScores,
  allHistoricalRounds,
  allHistoricalScores,
  selectedYear,
}: {
  player: Player
  standing: Standing
  seasonStandings: Standing[]
  seasonRounds: Round[]
  seasonScores: Score[]
  allHistoricalRounds: Round[]
  allHistoricalScores: Score[]
  selectedYear: number
}) {
  const playedScores  = seasonScores.filter(s => s.player_id === player.id && s.strokes != null)
  const ranks  = playedScores.map(s => s.rank).filter((r): r is number => r != null)
  const nets   = playedScores.map(s => s.strokes).filter((s): s is number => s != null)

  const bestFinish  = ranks.length ? Math.min(...ranks) : null
  const avgFinish   = avg(ranks)
  const avgNet      = avg(nets)
  const ptsPerRound = standing.rounds > 0 ? standing.points / standing.rounds : null

  // Season standings chart
  const fieldSize = Math.max(seasonStandings.length, 2)
  const runningPts: Record<string, number> = {}
  seasonStandings.forEach(s => { runningPts[s.player.id] = 0 })

  const posPoints = seasonRounds.map(r => {
    const roundScores = seasonScores.filter(sc => sc.round_id === r.id)
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

  let lastPos: number | null = null
  const chartPoints = posPoints.map(p => {
    if (p.played && p.pos != null) lastPos = p.pos
    return { played: p.played, pos: p.played ? p.pos : lastPos }
  })
  const currentPos = posPoints.reduceRight<number | null>((acc, p) => acc ?? (p.played ? p.pos : null), null)

  const CW = 300, CH = 160
  const LEFT = 40, RIGHT = 8, TOP = 12, BOTTOM = 20
  const chartW = CW - LEFT - RIGHT
  const chartH = CH - TOP - BOTTOM
  const sx = (i: number) => LEFT + (seasonRounds.length < 2 ? chartW / 2 : (i / (seasonRounds.length - 1)) * chartW)
  const sy = (pos: number) => TOP + ((pos - 1) / Math.max(fieldSize - 1, 1)) * chartH
  const yAxisPositions = Array.from({ length: fieldSize }, (_, i) => i + 1)

  const contextLine = chartPoints
    .map((p, i) => p.pos != null ? `${sx(i)},${sy(p.pos)}` : null)
    .filter((v): v is string => v !== null).join(' ')
  const playedPolyline = posPoints
    .map((p, i) => p.played && p.pos != null ? `${sx(i)},${sy(p.pos)}` : null)
    .filter((v): v is string => v !== null).join(' ')

  // Career stats — only rounds up to (and including) selectedYear
  const careerRoundIds = new Set(
    allHistoricalRounds
      .filter(r => new Date(r.date + 'T12:00:00').getFullYear() <= selectedYear)
      .map(r => r.id)
  )
  const careerPlayerScores = allHistoricalScores.filter(s =>
    s.player_id === player.id && careerRoundIds.has(s.round_id)
  )
  const careerRanks      = careerPlayerScores.map(s => s.rank).filter((r): r is number => r != null)
  const careerWins       = careerRanks.filter(r => r === 1).length
  const careerBest       = careerRanks.length ? Math.min(...careerRanks) : null
  const careerAvgFinish  = avg(careerRanks)

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
      <div className="md:grid md:grid-cols-2">

        {/* Season — col1/row1 */}
        <div className="md:col-start-1 md:row-start-1" style={{ padding: '14px 14px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#F5EFE0', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
            {selectedYear} Season
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {pill('Wins', `${standing.wins}`, standing.wins > 0)}
            {pill('Best finish', bestFinish != null ? ordinal(bestFinish) : '—')}
            {pill('Avg finish', avgFinish != null ? ordinal(Math.round(avgFinish)) : '—')}
            {pill('Avg net', avgNet != null ? String(Math.round(avgNet)) : '—')}
            {pill('Pts / round', ptsPerRound != null ? fmt(Math.round(ptsPerRound * 10) / 10) : '—')}
          </div>
        </div>

        {/* Chart — col1/row2 */}
        {seasonRounds.length > 0 && (
          <div className="md:col-start-1 md:row-start-2" style={{ padding: '10px 14px 0' }}>
            <div style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.09)',
              borderRadius: 10, padding: '12px 12px 10px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)' }}>
                  Season Standings
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--trophy-gold)', lineHeight: 1 }}>
                  {currentPos != null ? ordinal(currentPos) : '—'}
                </span>
              </div>
              <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
                {yAxisPositions.map(pos => (
                  <g key={pos}>
                    <line x1={LEFT} y1={sy(pos)} x2={CW - RIGHT} y2={sy(pos)}
                      stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeDasharray={pos === 1 ? 'none' : '3 5'} />
                    <text x={LEFT - 10} y={sy(pos) + 3.5} textAnchor="end"
                      style={{ fontSize: 8, fill: 'rgba(255,255,255,.35)', fontFamily: 'monospace' }}>
                      {ordinal(pos)}
                    </text>
                  </g>
                ))}
                {contextLine && <polyline points={contextLine} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.5" strokeDasharray="3 5" />}
                {playedPolyline && <polyline points={playedPolyline} fill="none" stroke="var(--trophy-gold)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
                {posPoints.map((p, i) => p.played && p.pos != null && (
                  <circle key={i} cx={sx(i)} cy={sy(p.pos)} r={i === posPoints.length - 1 ? 4.5 : 3} fill="var(--trophy-gold)" />
                ))}
                {seasonRounds.map((_, i) => (
                  <text key={i} x={sx(i)} y={CH} textAnchor="middle"
                    style={{ fontSize: 8, fill: 'rgba(255,255,255,.35)', fontFamily: 'monospace' }}>
                    {`R${i + 1}`}
                  </text>
                ))}
              </svg>
            </div>
          </div>
        )}

        {/* Round history — col2/rows1-3 */}
        <div className="md:col-start-2 md:row-start-1 md:row-span-3"
             style={{ padding: '10px 14px 0', borderLeft: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px 44px 44px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 2 }}>
            {['Date', 'Rank', 'Net', '+/−', 'Pts'].map((h, i) => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', textAlign: i > 0 ? 'center' : 'left' }}>
                {h}
              </span>
            ))}
          </div>
          {seasonRounds.map((r, i) => {
            const sc = seasonScores.find(s => s.round_id === r.id && s.player_id === player.id)
            const played = sc && sc.strokes != null
            const isDns = sc?.dnf === true && (sc?.points_earned === 0 || sc?.points_earned == null)
            const isDnf = sc?.dnf === true && !isDns
            const d = new Date(r.date + 'T12:00:00')
            const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            const diffColor = sc?.net_diff == null ? 'rgba(255,255,255,.30)'
              : sc.net_diff < 0 ? 'var(--tournament-red)' : '#F5EFE0'
            return (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 44px 44px 44px 44px',
                alignItems: 'center', padding: '7px 0',
                borderBottom: i < seasonRounds.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                opacity: played || isDnf || isDns ? 1 : 0.38,
              }}>
                <div>
                  <span style={{ fontSize: 12, color: '#F5EFE0', fontWeight: 500 }}>{dateStr}</span>
                  {r.double_points && <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--trophy-gold)' }}>⚡</span>}
                  {r.notes && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.40)', marginTop: 1 }}>{r.notes}</div>}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textAlign: 'center',
                  color: isDnf ? 'var(--tournament-red)' : isDns ? 'rgba(255,255,255,.40)' : played ? '#F5EFE0' : 'rgba(255,255,255,.30)' }}>
                  {isDns ? 'DNS' : isDnf ? 'DNF' : played ? ordinal(sc!.rank!) : '—'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'center', color: played ? '#F5EFE0' : 'rgba(255,255,255,.30)' }}>
                  {played ? sc!.strokes : '—'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textAlign: 'center', color: played ? diffColor : 'rgba(255,255,255,.30)' }}>
                  {played && sc!.net_diff != null ? (sc!.net_diff > 0 ? `+${sc!.net_diff}` : String(sc!.net_diff)) : '—'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, textAlign: 'center', color: played ? 'var(--trophy-gold)' : 'rgba(255,255,255,.30)' }}>
                  {played ? fmt(Number(sc!.points_earned)) : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Career — col1/row3 */}
        <div className="md:col-start-1 md:row-start-3" style={{ padding: '14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: '#F5EFE0', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
            Career (up to {selectedYear})
          </div>
          {careerRanks.length === 0 ? (
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

// ── Main page ────────────────────────────────────────────────────────────────

const PILL_COUNT = 3

export default function HistoryPage() {
  const [seasons, setSeasons]           = useState<Season[]>([])
  const [allRounds, setAllRounds]       = useState<Round[]>([])
  const [allScores, setAllScores]       = useState<Score[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [moreOpen, setMoreOpen]         = useState(false)
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const currentYear = new Date().getFullYear()

    const [{ data: roundsData }, { data: playersData }] = await Promise.all([
      db.from('rounds').select('*').lt('date', `${currentYear}-01-01`),
      db.from('players').select('*'),
    ])

    const typedRounds   = (roundsData  ?? []) as Round[]
    const typedPlayers  = (playersData ?? []) as Player[]

    const roundIds = typedRounds.map((r: Round) => r.id)
    const { data: scoresData } = roundIds.length > 0
      ? await db.from('scores').select('*').in('round_id', roundIds)
      : { data: [] }
    const typedScores = (scoresData ?? []) as Score[]

    setAllRounds(typedRounds)
    setAllScores(typedScores)

    // Group rounds by year
    const roundsByYear: Record<number, Round[]> = {}
    for (const r of typedRounds) {
      const year = new Date(r.date + 'T12:00:00').getFullYear()
      if (!roundsByYear[year]) roundsByYear[year] = []
      roundsByYear[year].push(r)
    }

    const builtSeasons: Season[] = Object.entries(roundsByYear)
      .map(([yearStr, yearRounds]) => {
        const year = Number(yearStr)
        const yearRoundIds = new Set(yearRounds.map(r => r.id))
        const yearScores = typedScores.filter(s => yearRoundIds.has(s.round_id))

        // Only build season if there are any scored rounds
        if (!yearScores.some(s => s.strokes != null || s.dnf)) return null

        const agg: Record<string, { points: number; rounds: number; wins: number }> = {}
        for (const s of yearScores) {
          if (!agg[s.player_id]) agg[s.player_id] = { points: 0, rounds: 0, wins: 0 }
          const isDns = s.dnf === true && (s.points_earned === 0 || s.points_earned == null)
          agg[s.player_id].points += Number(s.points_earned ?? 0)
          if (!isDns) agg[s.player_id].rounds += 1
          if (s.rank === 1) agg[s.player_id].wins += 1
        }

        const standings: Standing[] = Object.entries(agg)
          .map(([pid, data]) => {
            const player = typedPlayers.find(p => p.id === pid)
            if (!player) return null
            return { player, ...data }
          })
          .filter((s): s is Omit<Standing, 'rank'> & { rank?: number } => s !== null)
          .sort((a, b) => b.points - a.points || a.player.name.localeCompare(b.player.name))
          .map((s, i) => ({ ...s, rank: i + 1 })) as Standing[]

        const sortedRounds = [...yearRounds].sort((a, b) => a.date.localeCompare(b.date))

        return { year, rounds: sortedRounds, scores: yearScores, standings }
      })
      .filter((s): s is Season => s !== null)
      .sort((a, b) => b.year - a.year)

    setSeasons(builtSeasons)
    if (builtSeasons.length > 0) setSelectedYear(builtSeasons[0].year)
    setLoading(false)
  }

  const years         = seasons.map(s => s.year)
  const pillYears     = years.slice(0, PILL_COUNT)
  const overflowYears = years.slice(PILL_COUNT)
  const overflowActive = selectedYear != null && overflowYears.includes(selectedYear)
  const season        = seasons.find(s => s.year === selectedYear) ?? null
  const champion      = season?.standings[0] ?? null

  return (
    <div style={{ background: 'var(--bunker-sand)' }}>
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
          History
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14 }}>Loading…</div>
      ) : seasons.length === 0 ? (
        <div style={{ padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, textTransform: 'uppercase', color: '#F5EFE0', marginBottom: 6 }}>
            No completed seasons yet
          </div>
          <div style={{ fontSize: 13, color: '#8895AC' }}>
            Past seasons will appear here once the year ends.
          </div>
        </div>
      ) : (
        <>
          {/* Year selector */}
          <div style={{
            background: 'var(--tour-navy-deep)',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            padding: '12px 16px',
            display: 'flex', gap: 8,
          }}>
            {pillYears.map(year => (
              <button
                key={year}
                onClick={() => { setSelectedYear(year); setExpandedId(null) }}
                style={{
                  height: 34, padding: '0 18px', borderRadius: 999, border: 0,
                  background: selectedYear === year ? 'var(--trophy-gold)' : 'rgba(255,255,255,.08)',
                  color: selectedYear === year ? 'var(--tour-navy)' : '#B9C5D9',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                  letterSpacing: '.04em', cursor: 'pointer', flexShrink: 0,
                  transition: 'background .15s, color .15s',
                }}
              >
                {year}
              </button>
            ))}

            {overflowYears.length > 0 && (
              <div style={{ position: 'relative', marginLeft: 'auto' }}>
                {moreOpen && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setMoreOpen(false)} />
                )}
                <button
                  onClick={() => setMoreOpen(v => !v)}
                  style={{
                    height: 34, padding: '0 14px', borderRadius: 999, border: 0,
                    background: moreOpen || overflowActive ? 'var(--trophy-gold)' : 'rgba(255,255,255,.08)',
                    color: moreOpen || overflowActive ? 'var(--tour-navy)' : '#B9C5D9',
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                    letterSpacing: '.04em', cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'background .15s, color .15s',
                  }}
                >
                  {overflowActive ? selectedYear : 'More'}
                  <ChevronDown size={14} strokeWidth={2.5} style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </button>
                {moreOpen && (
                  <div style={{
                    position: 'absolute', top: 42, right: 0, zIndex: 20,
                    background: '#fff', border: '1px solid var(--bunker-sand-deep)',
                    borderRadius: 10, boxShadow: 'var(--shadow-pop)',
                    minWidth: 120, overflow: 'hidden',
                  }}>
                    {overflowYears.map((year, i) => (
                      <button
                        key={year}
                        onClick={() => { setSelectedYear(year); setMoreOpen(false); setExpandedId(null) }}
                        style={{
                          width: '100%', height: 44,
                          display: 'flex', alignItems: 'center', padding: '0 16px',
                          background: selectedYear === year ? 'rgba(201,162,74,.10)' : 'transparent',
                          border: 0,
                          borderBottom: i < overflowYears.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none',
                          color: selectedYear === year ? 'var(--tour-navy)' : 'var(--ink)',
                          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                          letterSpacing: '.04em', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {champion && season && (
            <>

              {/* ── Champion hero ── */}
              <section style={{ background: 'var(--tour-navy)', position: 'relative' }}>
              <div style={{ maxWidth: 480, margin: '0 auto' }}>

                {/* Status row */}
                <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    height: 28, padding: '0 12px', borderRadius: 999,
                    fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase',
                    background: 'var(--trophy-gold)', color: 'var(--tour-navy)',
                  }}>
                    Season Champion
                  </span>
                  <span style={{ fontSize: 11, letterSpacing: '.12em', color: '#B9C5D9', fontWeight: 700, textTransform: 'uppercase' }}>
                    {selectedYear}
                  </span>
                </div>

                {/* Hero card */}
                <div style={{ position: 'relative', height: 280, background: 'var(--tour-navy)' }}>
                  {/* Owl torso */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/owl-torso.png" alt="" aria-hidden
                    style={{
                      position: 'absolute', left: '-25%', top: '50%', transform: 'translateY(-50%)',
                      height: '130%', width: 'auto', maxWidth: 'none',
                      opacity: 0.12, pointerEvents: 'none', zIndex: 0,
                    }}
                  />
                  {/* Trophy */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/owl-trophy.png" alt="Trophy"
                    style={{
                      position: 'absolute', right: '-12%', bottom: '-6%',
                      height: '106%', width: 'auto',
                      opacity: 0.18, pointerEvents: 'none', zIndex: 0,
                    }}
                  />

                  {/* Player photo + gradient */}
                  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 1 }}>
                    {champion.player.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={champion.player.avatar_url}
                        alt={champion.player.name}
                        style={{
                          position: 'absolute', left: '50%', top: 0,
                          transform: 'translateX(-50%)',
                          height: '100%', width: 'min(56%, 245px)',
                          objectFit: 'cover', objectPosition: 'center 30%',
                        }}
                      />
                    ) : (
                      <div style={{
                        position: 'absolute', left: '50%', top: 0,
                        transform: 'translateX(-50%)',
                        height: '100%', width: 'min(56%, 245px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontSize: 120, fontWeight: 700,
                        color: 'rgba(255,255,255,.08)', lineHeight: 1, userSelect: 'none',
                      }}>
                        {champion.player.name[0].toUpperCase()}
                      </div>
                    )}
                    {/* Bottom gradient */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
                      background: 'linear-gradient(to top, rgba(10,34,64,.75) 0%, transparent 100%)',
                      pointerEvents: 'none',
                    }} />
                  </div>

                  {/* Stat boxes */}
                  <div style={{
                    position: 'absolute', bottom: 8, left: 12, right: 12, zIndex: 2,
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                  }}>
                    {([
                      { label: 'Champion',      value: '1st' },
                      { label: 'Season Points', value: `${fmt(champion.points)} pts` },
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

                {/* Full leaderboard link */}
                <div style={{ padding: '8px 16px 20px', textAlign: 'right' }}>
                  <a
                    href="#history-leaderboard"
                    style={{ fontSize: 12, fontWeight: 600, color: 'rgba(245,239,224,.55)', letterSpacing: '.04em', textDecoration: 'none' }}
                  >
                    Full leaderboard ↓
                  </a>
                </div>
              </div>
              </section>

              {/* ── Leaderboard ── */}
              <section id="history-leaderboard" style={{ background: 'var(--tour-navy)', marginTop: 15, scrollMarginTop: 56 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--tour-navy-deep)',
                  borderBottom: '1px solid rgba(255,255,255,.06)',
                }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, textTransform: 'uppercase', letterSpacing: '.04em', color: '#F5EFE0' }}>
                    {selectedYear} Standings
                  </span>
                  <span style={{ height: 22, padding: '0 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', background: 'rgba(201,162,74,.18)', color: 'var(--trophy-gold)', display: 'flex', alignItems: 'center' }}>
                    Final
                  </span>
                </div>

                <div className="broadcast-header" style={{ display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px 28px', alignItems: 'center', height: 30, padding: '0 14px' }}>
                  <span>POS</span>
                  <span>PLAYER</span>
                  <span style={{ textAlign: 'right' }}>ROUNDS</span>
                  <span style={{ textAlign: 'right' }}>POINTS</span>
                  <span />
                </div>

                <div>
                  {season.standings.map((s, i) => {
                    const isChamp    = i === 0
                    const isExpanded = expandedId === s.player.id
                    const rowBg = isExpanded ? 'rgba(201,162,74,.10)' : isChamp ? 'rgba(201,162,74,.15)' : 'transparent'
                    return (
                      <div key={s.player.id}>
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : s.player.id)}
                          style={{
                            display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px 28px',
                            alignItems: 'center', height: 52,
                            paddingLeft: 0, paddingRight: 14,
                            background: rowBg, color: '#F5EFE0',
                            borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,.06)',
                            borderLeft: isExpanded ? '3px solid var(--trophy-gold)' : '3px solid transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: isChamp || isExpanded ? 'var(--trophy-gold)' : '#B9C5D9', paddingLeft: 11 }}>
                            {s.rank}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <PlayerAvatar name={s.player.name} avatarUrl={s.player.avatar_url} size={28} gold={isChamp || isExpanded} />
                            <span style={{ fontWeight: 500, fontSize: 15, color: isExpanded ? 'var(--trophy-gold)' : '#F5EFE0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.player.name}
                            </span>
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#B9C5D9', textAlign: 'right' }}>
                            {s.rounds}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, textAlign: 'right', color: isChamp ? 'var(--trophy-gold)' : (s.points > 0 ? '#F5EFE0' : '#8895AC') }}>
                            {fmt(s.points)}
                          </span>
                          <span style={{ display: 'flex', justifyContent: 'center', color: '#8895AC' }}>
                            {isExpanded ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
                          </span>
                        </div>
                        {isExpanded && (
                          <HistoryStatsPanel
                            player={s.player}
                            standing={s}
                            seasonStandings={season.standings}
                            seasonRounds={season.rounds}
                            seasonScores={season.scores}
                            allHistoricalRounds={allRounds}
                            allHistoricalScores={allScores}
                            selectedYear={selectedYear!}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* ── Rounds ── */}
              <section style={{ padding: '20px 16px 24px', background: 'var(--bunker-sand)' }}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>{selectedYear} Rounds</div>
                <div style={{
                  background: '#fff',
                  border: '1px solid var(--bunker-sand-deep)',
                  borderRadius: 12,
                  boxShadow: 'var(--shadow-card)',
                  overflow: 'hidden',
                }}>
                  {[...season.rounds].reverse().map(({ id, date, notes, double_points }, i, arr) => {
                    const playerCount = new Set(season.scores.filter(s => s.round_id === id && s.strokes != null).map(s => s.player_id)).size
                    const d = new Date(date + 'T12:00:00')
                    return (
                      <Link
                        key={id}
                        href={`/rounds/${id}`}
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
                            {d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                            {d.getDate()}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink)', letterSpacing: '.02em' }}>
                            {d.toLocaleDateString('en-GB', { weekday: 'long' })}
                            {double_points && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--trophy-gold)' }}>⚡ Double</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                            {notes ? `${notes} · ` : ''}{playerCount} player{playerCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <span style={{
                          height: 22, padding: '0 9px', borderRadius: 999,
                          fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                          background: 'rgba(31,122,76,.14)', color: 'var(--fairway-green)',
                          display: 'flex', alignItems: 'center',
                        }}>Scored</span>
                        <ChevronRight size={16} color="var(--ink-faint)" strokeWidth={2} />
                      </Link>
                    )
                  })}
                </div>
              </section>

            </>
          )}
        </>
      )}
    </div>
  )
}
