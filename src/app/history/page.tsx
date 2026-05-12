'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Trophy, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Player, Score } from '@/lib/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface Standing {
  rank: number
  name: string
  initials: string
  rounds: number
  wins: number
  points: number
}

interface Season {
  year: number
  standings: Standing[]
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function fmt(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

const ORDINALS: Record<number, string> = { 1: '1ST', 2: '2ND', 3: '3RD' }
function ordinal(n: number) { return ORDINALS[n] ?? `${n}TH` }

function Avatar({ initials, size = 28, gold = false }: { initials: string; size?: number; gold?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: gold ? 'var(--trophy-gold)' : 'var(--tour-navy)',
      color: gold ? 'var(--tour-navy)' : '#F5EFE0',
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: size * 0.42, letterSpacing: '.04em',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {initials}
    </div>
  )
}

const PILL_COUNT = 3

export default function HistoryPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const currentYear = new Date().getFullYear()

    const [{ data: rounds }, { data: scores }, { data: players }] = await Promise.all([
      db.from('rounds').select('id, date').lt('date', `${currentYear}-01-01`),
      db.from('scores').select('*'),
      db.from('players').select('*'),
    ])

    // Group round IDs by year
    const roundsByYear: Record<number, Set<string>> = {}
    for (const r of (rounds ?? [])) {
      const year = new Date(r.date + 'T12:00:00').getFullYear()
      if (!roundsByYear[year]) roundsByYear[year] = new Set()
      roundsByYear[year].add(r.id)
    }

    const typedPlayers = (players ?? []) as Player[]
    const typedScores  = (scores  ?? []) as Score[]

    // Build a season for each past year that has scored rounds
    const builtSeasons: Season[] = Object.entries(roundsByYear)
      .map(([yearStr, roundIds]) => {
        const year = Number(yearStr)
        const yearScores = typedScores.filter(s => roundIds.has(s.round_id) && s.strokes != null)
        if (yearScores.length === 0) return null

        const agg: Record<string, { points: number; rounds: number; wins: number }> = {}
        for (const s of yearScores) {
          if (!agg[s.player_id]) agg[s.player_id] = { points: 0, rounds: 0, wins: 0 }
          agg[s.player_id].points += Number(s.points_earned ?? 0)
          agg[s.player_id].rounds += 1
          if (s.rank === 1) agg[s.player_id].wins += 1
        }

        const standings: Standing[] = Object.entries(agg)
          .map(([pid, data]) => {
            const player = typedPlayers.find(p => p.id === pid)
            return { name: player?.name ?? '?', initials: getInitials(player?.name ?? '?'), ...data }
          })
          .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
          .map((s, i) => ({ ...s, rank: i + 1 }))

        return { year, standings }
      })
      .filter((s): s is Season => s !== null)
      .sort((a, b) => b.year - a.year)

    setSeasons(builtSeasons)
    if (builtSeasons.length > 0) setSelectedYear(builtSeasons[0].year)
    setLoading(false)
  }

  const years        = seasons.map(s => s.year)
  const pillYears    = years.slice(0, PILL_COUNT)
  const overflowYears = years.slice(PILL_COUNT)
  const overflowActive = selectedYear != null && overflowYears.includes(selectedYear)
  const season       = seasons.find(s => s.year === selectedYear) ?? null
  const champion     = season?.standings[0] ?? null

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
          History
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14 }}>Loading…</div>
      ) : seasons.length === 0 ? (
        <div style={{ padding: '64px 24px', textAlign: 'center' }}>
          <Trophy size={40} color="var(--ink-faint)" strokeWidth={1.5} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 6 }}>
            No completed seasons yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
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
                onClick={() => setSelectedYear(year)}
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
                    background: '#fff',
                    border: '1px solid var(--bunker-sand-deep)',
                    borderRadius: 10,
                    boxShadow: 'var(--shadow-pop)',
                    minWidth: 120, overflow: 'hidden',
                  }}>
                    {overflowYears.map((year, i) => (
                      <button
                        key={year}
                        onClick={() => { setSelectedYear(year); setMoreOpen(false) }}
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

          {/* Champion card */}
          {champion && season && (
            <>
              <section style={{ padding: '20px 16px 0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>
                  Champion
                </div>

                <div style={{
                  position: 'relative', borderRadius: 16, overflow: 'hidden', height: 224,
                  background: 'linear-gradient(140deg, #0A2240 25%, #5C1525 100%)',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--trophy-gold)' }} />
                  <div style={{ position: 'absolute', right: -16, top: '50%', transform: 'translateY(-54%)', opacity: 0.09, pointerEvents: 'none' }}>
                    <Trophy size={230} strokeWidth={0.7} color="#fff" />
                  </div>
                  <div style={{ position: 'absolute', top: 3, bottom: 60, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <div style={{
                      width: 84, height: 84, borderRadius: '50%',
                      background: 'rgba(201,162,74,.18)', border: '2.5px solid var(--trophy-gold)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28,
                      letterSpacing: '.04em', color: 'var(--trophy-gold)',
                    }}>
                      {champion.initials}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, textTransform: 'uppercase', letterSpacing: '.04em', color: '#fff' }}>
                      {champion.name}
                    </div>
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
                    background: 'rgba(0,0,0,.50)', backdropFilter: 'blur(6px)',
                    display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', alignItems: 'center',
                  }}>
                    {[
                      { label: 'POS',  value: ordinal(champion.rank), mono: false, gold: true  },
                      null,
                      { label: 'WINS', value: String(champion.wins),  mono: false, gold: false },
                      null,
                      { label: 'PTS',  value: fmt(champion.points),   mono: true,  gold: true  },
                    ].map((col, i) =>
                      col === null ? (
                        <div key={i} style={{ height: 28, background: 'rgba(255,255,255,.12)' }} />
                      ) : (
                        <div key={i} style={{ textAlign: 'center', padding: '0 8px' }}>
                          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8895AC', marginBottom: 3 }}>{col.label}</div>
                          <div style={{ fontFamily: col.mono ? 'var(--font-mono)' : 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '.02em', color: col.gold ? 'var(--trophy-gold)' : '#F5EFE0' }}>
                            {col.value}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </section>

              {/* Full standings */}
              <section style={{ background: 'var(--tour-navy)', marginTop: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--tour-navy-deep)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, textTransform: 'uppercase', letterSpacing: '.04em', color: '#F5EFE0' }}>
                    {selectedYear} Standings
                  </span>
                  <span style={{ height: 22, padding: '0 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', background: 'rgba(201,162,74,.18)', color: 'var(--trophy-gold)', display: 'flex', alignItems: 'center' }}>
                    Final
                  </span>
                </div>
                <div className="broadcast-header" style={{ display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px', alignItems: 'center', height: 30, padding: '0 14px' }}>
                  <span>POS</span><span>PLAYER</span>
                  <span style={{ textAlign: 'right' }}>ROUNDS</span>
                  <span style={{ textAlign: 'right' }}>POINTS</span>
                </div>
                {season.standings.map((s, i) => {
                  const isChamp = i === 0
                  return (
                    <div key={s.name + s.rank} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px', alignItems: 'center', height: 52, padding: '0 14px', background: isChamp ? 'rgba(201,162,74,.15)' : 'transparent', color: '#F5EFE0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: isChamp ? 'var(--trophy-gold)' : '#B9C5D9' }}>{s.rank}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Avatar initials={s.initials} size={28} gold={isChamp} />
                        <span style={{ fontWeight: 500, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        {s.wins > 0 && (
                          <span style={{ flexShrink: 0, height: 18, padding: '0 6px', borderRadius: 999, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', background: 'rgba(201,162,74,.25)', color: 'var(--trophy-gold)', display: 'flex', alignItems: 'center' }}>
                            {s.wins}W
                          </span>
                        )}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#B9C5D9', textAlign: 'right' }}>{s.rounds}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, textAlign: 'right', color: isChamp ? 'var(--trophy-gold)' : '#F5EFE0' }}>{fmt(s.points)}</span>
                    </div>
                  )
                })}
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}
