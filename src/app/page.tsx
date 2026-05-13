'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player, Round, Score } from '@/lib/database.types'
import { ChevronRight } from 'lucide-react'
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

export default function DashboardPage() {
  const [standings, setStandings] = useState<Standing[]>([])
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([])
  const [todayRound, setTodayRound] = useState<Round | null>(null)
  const [loading, setLoading] = useState(true)
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
    <div>
      {/* ── Hero ── */}
      <section
        className="bg-dimple"
        style={{
          background: 'var(--tour-navy)',
          padding: '68px 0 0',
          position: 'relative',
        }}
      >
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
            <div style={{ position: 'relative', height: 280, overflow: 'hidden', background: 'var(--tour-navy)' }}>

              {/* Owl torso watermark — left side, behind everything */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/owl-torso.png"
                alt=""
                aria-hidden
                style={{
                  position: 'absolute', left: '-25%', top: '50%', transform: 'translateY(-50%)',
                  height: '130%', width: 'auto', maxWidth: 'none',
                  opacity: 0.12, pointerEvents: 'none',
                }}
              />

              {/* Player photo — centered */}
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

              {/* Trophy — right of player, in front */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/owl-trophy.png"
                alt="Trophy"
                style={{
                  position: 'absolute', right: '-12%', bottom: '-6%',
                  height: '106%', width: 'auto',
                  opacity: 0.12,
                  pointerEvents: 'none',
                }}
              />

              {/* Stat boxes */}
              <div style={{
                position: 'absolute', bottom: 8, left: 12, right: 12,
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
      <section id="leaderboard" style={{ background: 'var(--tour-navy)', marginTop: 0, scrollMarginTop: 56 }}>
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
          display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px',
          alignItems: 'center', height: 30, padding: '0 14px',
        }}>
          <span>POS</span>
          <span>PLAYER</span>
          <span style={{ textAlign: 'right' }}>ROUNDS</span>
          <span style={{ textAlign: 'right' }}>POINTS</span>
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
              const isLeader = i === 0 && hasData
              const rowBg = isLeader ? 'rgba(201,162,74,.15)' : 'transparent'
              return (
                <div
                  key={s.player.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px',
                    alignItems: 'center', height: 52, padding: '0 14px',
                    background: rowBg, color: '#F5EFE0',
                    borderBottom: '1px solid rgba(255,255,255,.06)',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500,
                    color: isLeader ? 'var(--trophy-gold)' : '#B9C5D9',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <PlayerAvatar name={s.player.name} avatarUrl={s.player.avatar_url} size={28} gold={isLeader} />
                    <span style={{ fontWeight: 500, fontSize: 15, color: '#F5EFE0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.player.name}
                    </span>
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#B9C5D9', textAlign: 'right' }}>
                    {s.roundsPlayed}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18,
                    textAlign: 'right',
                    color: isLeader ? 'var(--trophy-gold)' : (s.totalPoints > 0 ? '#F5EFE0' : '#8895AC'),
                  }}>
                    {formatPts(s.totalPoints)}
                  </span>
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
