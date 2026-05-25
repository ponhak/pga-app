'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/lib/database.types'
import { randomizeGroups } from '@/lib/points'
import { toast } from 'sonner'
import { Shuffle, ChevronRight } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { PlayerAvatar } from '@/components/PlayerAvatar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any


export default function NewRoundPage() {
  const router = useRouter()
  const { session, loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [groupSize, setGroupSize] = useState(4)
  const [groups, setGroups] = useState<string[][]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace('/login')
      return
    }
    db.from('players').select('*').order('name').then(({ data }: { data: Player[] }) => {
      setPlayers(data ?? [])
      setSelected(new Set((data ?? []).map((p: Player) => p.id)))
    })
  }, [authLoading, session])

  function togglePlayer(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setGroups([])
  }

  function selectAll() {
    setSelected(new Set(players.map((p) => p.id)))
    setGroups([])
  }

  function doRandomize() {
    if (selected.size < 2) { toast.error('Select at least 2 players'); return }
    setGroups(randomizeGroups(Array.from(selected), groupSize))
  }

  function nameOf(id: string) {
    return players.find((p) => p.id === id)?.name ?? id
  }

  async function saveRound() {
    if (selected.size < 2) { toast.error('Select at least 2 players'); return }
    setSaving(true)
    try {
      const { data: round, error: roundErr } = await db
        .from('rounds')
        .insert({ date, group_size: groupSize })
        .select()
        .single()
      if (roundErr || !round) throw roundErr

      await db.from('round_players').insert(
        Array.from(selected).map((pid) => ({ round_id: round.id, player_id: pid }))
      )

      if (groups.length > 0) {
        for (let i = 0; i < groups.length; i++) {
          const { data: grp } = await db
            .from('groups')
            .insert({ round_id: round.id, group_number: i + 1 })
            .select()
            .single()
          if (grp) {
            await db.from('group_members').insert(
              groups[i].map((pid: string) => ({ group_id: grp.id, player_id: pid }))
            )
          }
        }
      }

      toast.success('Round created!')
      // Fire-and-forget calendar invite — don't block navigation on failure
      fetch('/api/send-calendar-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: round.id }),
      }).catch(() => {})
      router.push(`/rounds/${round.id}`)
    } catch {
      toast.error('Failed to create round')
      setSaving(false)
    }
  }

  const selectedPlayers = players.filter((p) => selected.has(p.id))

  return (
    <div style={{ background: 'var(--bunker-sand)', minHeight: '100%' }}>
      {/* Page header */}
      <div style={{
        padding: '16px',
        background: 'var(--tour-navy-deep)',
        borderBottom: '2px solid var(--trophy-gold)',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24,
          textTransform: 'uppercase', letterSpacing: '.02em', color: '#F5EFE0',
        }}>
          New Round
        </div>
        <div style={{ fontSize: 13, color: '#B9C5D9', marginTop: 4 }}>
          Set date · select field · randomize groups
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Date */}
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
            Round Date
          </div>
          <div style={{ padding: '12px 14px' }}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                height: 44, padding: '0 12px',
                borderRadius: 8, border: '1px solid var(--bunker-sand-deep)',
                background: 'var(--bunker-sand)', color: 'var(--ink)',
                fontFamily: 'var(--font-body)', fontSize: 15,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Select players */}
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
                {selected.size} selected
              </span>
              <button
                onClick={selectAll}
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

          {players.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: 14, color: 'var(--ink-soft)' }}>
              No players yet.{' '}
              <a href="/players" style={{ color: 'var(--tour-navy)', fontWeight: 700, textDecoration: 'underline' }}>Add players first.</a>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ padding: '10px 14px', gap: 8 }}>
              {players.map((p) => {
                const on = selected.has(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
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
            {/* Group size */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                Per group:
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => { setGroupSize(n); setGroups([]) }}
                    style={{
                      width: 40, height: 40, borderRadius: 8, border: 0,
                      background: groupSize === n ? 'var(--tour-navy)' : 'var(--bunker-sand)',
                      color: groupSize === n ? '#F5EFE0' : 'var(--ink)',
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
              onClick={doRandomize}
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

            {groups.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ gap: 8 }}>
                {groups.map((group, i) => (
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
                      {group.map((pid) => (
                        <li key={pid} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <PlayerAvatar name={nameOf(pid)} avatarUrl={players.find(p => p.id === pid)?.avatar_url} size={22} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{nameOf(pid)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {selectedPlayers.length > 0 && selectedPlayers.length % groupSize !== 0 && (
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>
                Note: {selectedPlayers.length} players doesn&apos;t divide evenly into groups of {groupSize} — the last group will be smaller.
              </p>
            )}
          </div>
        </div>

        {/* Start round button */}
        <button
          onClick={saveRound}
          disabled={saving || selected.size < 2}
          style={{
            height: 52, borderRadius: 10, border: 0,
            background: saving || selected.size < 2 ? '#ccc' : 'var(--tournament-red)',
            color: saving || selected.size < 2 ? '#999' : '#fff',
            fontFamily: 'var(--font-body)', fontWeight: 700,
            fontSize: 15, letterSpacing: '.06em', textTransform: 'uppercase',
            cursor: saving || selected.size < 2 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {saving ? 'Creating round…' : `Start Round · ${selected.size} players`}
          {!saving && selected.size >= 2 && <ChevronRight size={18} strokeWidth={2} />}
        </button>

      </div>
    </div>
  )
}
