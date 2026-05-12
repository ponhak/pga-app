'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface NextRound {
  id: string
  date: string
  group_size: number
  notes: string | null
}

interface TimeLeft {
  days: number
  hrs: number
  min: number
  sec: number
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function getTimeLeft(targetDate: string): TimeLeft {
  const now = Date.now()
  const target = new Date(targetDate + 'T08:00:00').getTime()
  const diff = Math.max(0, target - now)
  const totalSec = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSec / 86400),
    hrs:  Math.floor((totalSec % 86400) / 3600),
    min:  Math.floor((totalSec % 3600) / 60),
    sec:  totalSec % 60,
  }
}

export function NextRoundCountdown({ playerCount }: { playerCount: number }) {
  const [round, setRound] = useState<NextRound | null>(null)
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await db
        .from('rounds')
        .select('id, date, group_size, notes')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1)
      const next: NextRound | null = data?.[0] ?? null
      setRound(next)
      if (next) setTimeLeft(getTimeLeft(next.date))
      setLoaded(true)
    }
    load()
  }, [])

  useEffect(() => {
    if (!round) return
    const id = setInterval(() => setTimeLeft(getTimeLeft(round.date)), 1000)
    return () => clearInterval(id)
  }, [round])

  if (!loaded || !round || !timeLeft) return null

  const venue = round.notes?.trim() || 'TBD'
  const dateLabel = new Date(round.date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  return (
    <div style={{ background: 'var(--tour-navy-deep)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
      {/* Venue row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px 0',
        fontSize: 11, color: '#B9C5D9', fontWeight: 600, letterSpacing: '.08em',
      }}>
        <MapPin size={12} strokeWidth={2.5} color="#B9C5D9" />
        <span style={{ textTransform: 'uppercase' }}>{venue}</span>
        <span style={{ marginLeft: 'auto', color: '#8895AC' }}>{dateLabel}</span>
      </div>

      {/* Label */}
      <div style={{
        padding: '10px 14px 4px',
        fontSize: 10, fontWeight: 700, letterSpacing: '.18em',
        textTransform: 'uppercase', color: 'var(--trophy-gold)',
      }}>
        First Tee
      </div>

      {/* Countdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        padding: '0 10px 12px',
        gap: 2,
      }}>
        {[
          { val: pad(timeLeft.days), lbl: 'Days' },
          { val: pad(timeLeft.hrs),  lbl: 'Hrs' },
          { val: pad(timeLeft.min),  lbl: 'Min' },
          { val: pad(timeLeft.sec),  lbl: 'Sec' },
        ].map(({ val, lbl }, i) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: 42, lineHeight: 1, letterSpacing: '-.01em',
                color: '#fff',
              }}>
                {val}
              </div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '.14em',
                textTransform: 'uppercase', color: '#8895AC', marginTop: 2,
              }}>
                {lbl}
              </div>
            </div>
            {i < 3 && (
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: 36, color: 'rgba(255,255,255,.25)',
                lineHeight: 1, paddingBottom: 14, marginLeft: 2,
              }}>:</div>
            )}
          </div>
        ))}
      </div>

      {/* CTA buttons */}
      <div style={{ display: 'flex', gap: 10, padding: '0 14px 14px' }}>
        <Link
          href="/rounds/new"
          style={{
            flex: 1, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--tournament-red)', color: '#fff',
            borderRadius: 6, fontWeight: 700, fontSize: 12, letterSpacing: '.10em',
            textTransform: 'uppercase', textDecoration: 'none',
          }}
        >
          Register
        </Link>
        <Link
          href={`/rounds/${round.id}`}
          style={{
            flex: 1, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', color: '#F5EFE0',
            border: '1px solid rgba(255,255,255,.22)',
            borderRadius: 6, fontWeight: 700, fontSize: 12, letterSpacing: '.10em',
            textTransform: 'uppercase', textDecoration: 'none',
          }}
        >
          Leaderboard
        </Link>
      </div>

      {/* Info strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        borderTop: '1px solid rgba(255,255,255,.08)',
      }}>
        {[
          { lbl: 'Format', val: 'Stroke play' },
          { lbl: 'Field',  val: `${playerCount} players` },
        ].map((it, i) => (
          <div key={i} style={{
            padding: '9px 14px',
            borderRight: i === 0 ? '1px solid rgba(255,255,255,.08)' : 'none',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '.14em',
              textTransform: 'uppercase', color: '#8895AC',
            }}>
              {it.lbl}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '.04em',
              color: '#F5EFE0', marginTop: 2,
            }}>
              {it.val}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
