'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Trophy } from 'lucide-react'

// ── DUMMY DATA — edit names, rounds, wins and points to match reality ─────────
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

const SEASONS: Season[] = [
  {
    year: 2025,
    standings: [
      { rank: 1, name: 'Kristoffer',  initials: 'KL', rounds: 9, wins: 3, points: 148 },
      { rank: 2, name: 'Nicklas',     initials: 'NJ', rounds: 9, wins: 2, points: 132 },
      { rank: 3, name: 'Hans',        initials: 'HL', rounds: 8, wins: 1, points: 119 },
      { rank: 4, name: 'Niclas',      initials: 'NN', rounds: 9, wins: 1, points: 108 },
      { rank: 5, name: 'Ruben',       initials: 'RS', rounds: 7, wins: 0, points: 89  },
      { rank: 6, name: 'Marcus',      initials: 'MK', rounds: 8, wins: 0, points: 74  },
      { rank: 7, name: 'Jonas',       initials: 'JA', rounds: 6, wins: 0, points: 55  },
      { rank: 8, name: 'Erik',        initials: 'EL', rounds: 5, wins: 0, points: 38  },
    ],
  },
  {
    year: 2024,
    standings: [
      { rank: 1, name: 'Hans',        initials: 'HL', rounds: 10, wins: 4, points: 162 },
      { rank: 2, name: 'Kristoffer',  initials: 'KL', rounds: 10, wins: 2, points: 141 },
      { rank: 3, name: 'Niclas',      initials: 'NN', rounds: 9,  wins: 1, points: 125 },
      { rank: 4, name: 'Nicklas',     initials: 'NJ', rounds: 10, wins: 2, points: 118 },
      { rank: 5, name: 'Ruben',       initials: 'RS', rounds: 8,  wins: 0, points: 97  },
      { rank: 6, name: 'Jonas',       initials: 'JA', rounds: 9,  wins: 1, points: 83  },
      { rank: 7, name: 'Marcus',      initials: 'MK', rounds: 7,  wins: 0, points: 61  },
      { rank: 8, name: 'Erik',        initials: 'EL', rounds: 6,  wins: 0, points: 44  },
    ],
  },
  {
    year: 2023,
    standings: [
      { rank: 1, name: 'Nicklas',     initials: 'NJ', rounds: 8, wins: 3, points: 133 },
      { rank: 2, name: 'Niclas',      initials: 'NN', rounds: 8, wins: 2, points: 121 },
      { rank: 3, name: 'Kristoffer',  initials: 'KL', rounds: 7, wins: 1, points: 109 },
      { rank: 4, name: 'Hans',        initials: 'HL', rounds: 8, wins: 1, points: 98  },
      { rank: 5, name: 'Marcus',      initials: 'MK', rounds: 6, wins: 0, points: 72  },
      { rank: 6, name: 'Ruben',       initials: 'RS', rounds: 7, wins: 0, points: 65  },
      { rank: 7, name: 'Erik',        initials: 'EL', rounds: 5, wins: 0, points: 47  },
      { rank: 8, name: 'Jonas',       initials: 'JA', rounds: 4, wins: 0, points: 29  },
    ],
  },
  {
    year: 2022,
    standings: [
      { rank: 1, name: 'Hans',        initials: 'HL', rounds: 7, wins: 3, points: 118 },
      { rank: 2, name: 'Marcus',      initials: 'MK', rounds: 7, wins: 2, points: 104 },
      { rank: 3, name: 'Ruben',       initials: 'RS', rounds: 6, wins: 1, points: 91  },
      { rank: 4, name: 'Nicklas',     initials: 'NJ', rounds: 7, wins: 0, points: 83  },
      { rank: 5, name: 'Kristoffer',  initials: 'KL', rounds: 5, wins: 1, points: 70  },
      { rank: 6, name: 'Niclas',      initials: 'NN', rounds: 6, wins: 0, points: 58  },
      { rank: 7, name: 'Jonas',       initials: 'JA', rounds: 5, wins: 0, points: 41  },
      { rank: 8, name: 'Erik',        initials: 'EL', rounds: 4, wins: 0, points: 27  },
    ],
  },
]
// ─────────────────────────────────────────────────────────────────────────────

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

function fmt(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

const ORDINALS: Record<number, string> = { 1: '1ST', 2: '2ND', 3: '3RD' }
function ordinal(n: number) { return ORDINALS[n] ?? `${n}TH` }

export default function HistoryPage() {
  const years = SEASONS.map(s => s.year)
  const [selectedYear, setSelectedYear] = useState(years[0])
  const [moreOpen, setMoreOpen] = useState(false)
  const season = SEASONS.find(s => s.year === selectedYear)!
  const champion = season.standings[0]

  const PILL_COUNT = 3
  const pillYears     = years.slice(0, PILL_COUNT)
  const overflowYears = years.slice(PILL_COUNT)
  const overflowActive = overflowYears.includes(selectedYear)

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
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 19 }}
                onClick={() => setMoreOpen(false)}
              />
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
              <ChevronDown
                size={14}
                strokeWidth={2.5}
                style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
              />
            </button>

            {moreOpen && (
              <div style={{
                position: 'absolute', top: 42, right: 0, zIndex: 20,
                background: '#fff',
                border: '1px solid var(--bunker-sand-deep)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-pop)',
                minWidth: 120,
                overflow: 'hidden',
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
      <section style={{ padding: '20px 16px 0' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
          color: 'var(--ink-faint)', marginBottom: 10,
        }}>
          Champion
        </div>

        <div style={{
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          height: 224,
          background: 'linear-gradient(140deg, #0A2240 25%, #5C1525 100%)',
        }}>
          {/* Gold top bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--trophy-gold)' }} />

          {/* Watermark trophy */}
          <div style={{
            position: 'absolute', right: -16, top: '50%',
            transform: 'translateY(-54%)',
            opacity: 0.09, pointerEvents: 'none',
          }}>
            <Trophy size={230} strokeWidth={0.7} color="#fff" />
          </div>

          {/* Player */}
          <div style={{
            position: 'absolute',
            top: 3, bottom: 60, left: 0, right: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <div style={{
              width: 84, height: 84, borderRadius: '50%',
              background: 'rgba(201,162,74,.18)',
              border: '2.5px solid var(--trophy-gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 28, letterSpacing: '.04em', color: 'var(--trophy-gold)',
            }}>
              {champion.initials}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 26, textTransform: 'uppercase', letterSpacing: '.04em',
              color: '#fff',
            }}>
              {champion.name}
            </div>
          </div>

          {/* Bottom stats bar */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
            background: 'rgba(0,0,0,.50)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
            alignItems: 'center',
          }}>
            {[
              { label: 'POS',   value: ordinal(champion.rank), mono: false, gold: true  },
              null,
              { label: 'WINS',  value: String(champion.wins), mono: false, gold: false },
              null,
              { label: 'PTS',   value: fmt(champion.points),  mono: true,  gold: true  },
            ].map((col, i) =>
              col === null ? (
                <div key={i} style={{ height: 28, background: 'rgba(255,255,255,.12)' }} />
              ) : (
                <div key={i} style={{ textAlign: 'center', padding: '0 8px' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8895AC', marginBottom: 3 }}>
                    {col.label}
                  </div>
                  <div style={{
                    fontFamily: col.mono ? 'var(--font-mono)' : 'var(--font-display)',
                    fontWeight: 700, fontSize: 20, letterSpacing: '.02em',
                    color: col.gold ? 'var(--trophy-gold)' : '#F5EFE0',
                  }}>
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
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--tour-navy-deep)',
          borderBottom: '1px solid rgba(255,255,255,.06)',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, textTransform: 'uppercase', letterSpacing: '.04em', color: '#F5EFE0' }}>
            {selectedYear} Standings
          </span>
          <span style={{
            height: 22, padding: '0 9px', borderRadius: 999,
            fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase',
            background: 'rgba(201,162,74,.18)', color: 'var(--trophy-gold)',
            display: 'flex', alignItems: 'center',
          }}>
            Final
          </span>
        </div>

        <div className="broadcast-header" style={{
          display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px',
          alignItems: 'center', height: 30, padding: '0 14px',
        }}>
          <span>POS</span>
          <span>PLAYER</span>
          <span style={{ textAlign: 'right' }}>ROUNDS</span>
          <span style={{ textAlign: 'right' }}>POINTS</span>
        </div>

        {season.standings.map((s, i) => {
          const isChamp = i === 0
          return (
            <div
              key={s.name + s.rank}
              style={{
                display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px',
                alignItems: 'center', height: 52, padding: '0 14px',
                background: isChamp ? 'rgba(201,162,74,.15)' : 'transparent',
                color: '#F5EFE0',
                borderBottom: '1px solid rgba(255,255,255,.06)',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500,
                color: isChamp ? 'var(--trophy-gold)' : '#B9C5D9',
              }}>
                {s.rank}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Avatar initials={s.initials} size={28} gold={isChamp} />
                <span style={{ fontWeight: 500, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
                {s.wins > 0 && (
                  <span style={{
                    flexShrink: 0, height: 18, padding: '0 6px', borderRadius: 999,
                    fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
                    background: 'rgba(201,162,74,.25)', color: 'var(--trophy-gold)',
                    display: 'flex', alignItems: 'center',
                  }}>
                    {s.wins}W
                  </span>
                )}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#B9C5D9', textAlign: 'right' }}>
                {s.rounds}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, textAlign: 'right',
                color: isChamp ? 'var(--trophy-gold)' : '#F5EFE0',
              }}>
                {fmt(s.points)}
              </span>
            </div>
          )
        })}
      </section>
    </div>
  )
}
