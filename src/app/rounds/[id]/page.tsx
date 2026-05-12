'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { assignPoints } from '@/lib/points'
import type { Player, Round, Score } from '@/lib/database.types'
import { toast } from 'sonner'
import { ChevronLeft, Save, ScanLine, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ── Scorecard OCR helpers ────────────────────────────────────────────────────

// Swedish nickname pairs: key = nickname as stored in app, value = real-name variants on scorecard
const NICKNAMES: Record<string, string[]> = {
  bulan: ['kristoffer'],
  champ: ['nicklas'],
  hasse: ['hans'],
  stewe: ['steve', 'steven'],
}

function parseGolfGameBook(ocrText: string): { name: string; strokes: number }[] {
  const results: { name: string; strokes: number }[] = []
  for (const raw of ocrText.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    // Skip HCP / badge lines
    if (/^hcp\s/i.test(line) || /handicaprond/i.test(line)) continue
    // Match: optional rank, name text, gross score (2-3 digits), signed par (+/-N)
    const m = line.match(/^(?:\d+[\.\)]\s+)?([A-Za-zÅÄÖåäöÉéÜü\s\-]+?)\s{2,}(\d{2,3})\s+[+\-]\d/)
      ?? line.match(/^(?:\d+[\.\)]\s+)?([A-Za-zÅÄÖåäöÉéÜü\s\-]+?)\s+(\d{2,3})\s+[+\-]\d/)
    if (!m) continue
    const strokes = Number(m[2])
    if (strokes < 60 || strokes > 150) continue
    results.push({ name: m[1].trim(), strokes })
  }
  return results
}

function matchScorecardName(scorecardName: string, playerNames: string[]): string | null {
  const first = scorecardName.split(/\s+/)[0].toLowerCase()
  for (const pName of playerNames) {
    const pFirst = pName.split(/\s+/)[0].toLowerCase()
    if (pFirst === first) return pName
    // Check nickname table in both directions
    if ((NICKNAMES[pFirst] ?? []).includes(first)) return pName
    if ((NICKNAMES[first] ?? []).includes(pFirst)) return pName
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
  const [round, setRound] = useState<Round | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [groups, setGroups] = useState<GroupWithMembers[]>([])
  const [scores, setScores] = useState<Record<string, string>>({})
  const [savedScores, setSavedScores] = useState<Score[]>([])
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadRound() }, [id])

  async function loadRound() {
    const [{ data: roundData }, { data: rpData }, { data: grpData }, { data: scoreData }] =
      await Promise.all([
        db.from('rounds').select('*').eq('id', id).single(),
        db.from('round_players').select('player_id, players(*)').eq('round_id', id),
        db.from('groups').select('id, group_number, group_members(player_id, players(*))').eq('round_id', id).order('group_number'),
        db.from('scores').select('*').eq('round_id', id),
      ])

    if (roundData) setRound(roundData as Round)

    if (rpData) {
      const ps = (rpData as { player_id: string; players: Player }[]).map((r) => r.players)
      setPlayers(ps.sort((a, b) => a.name.localeCompare(b.name)))
    }

    if (grpData) {
      const mapped: GroupWithMembers[] = (grpData as {
        id: string
        group_number: number
        group_members: { player_id: string; players: Player }[]
      }[]).map((g) => ({
        id: g.id,
        group_number: g.group_number,
        members: g.group_members.map((m) => m.players),
      }))
      setGroups(mapped)
    }

    if (scoreData) {
      const typed = scoreData as Score[]
      setSavedScores(typed)
      const existing: Record<string, string> = {}
      typed.forEach((s) => {
        if (s.strokes != null) existing[s.player_id] = String(s.strokes)
      })
      setScores((prev) => ({ ...prev, ...existing }))
    }
  }

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
      const upserts = results.map((r) => ({
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
      // Read image as data URL for Tesseract
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Dynamic import keeps Tesseract out of SSR bundle
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      const { data: { text } } = await worker.recognize(dataUrl)
      await worker.terminate()

      const extracted = parseGolfGameBook(text)
      const playerNames = players.map((p) => p.name)

      const matched: Record<string, string> = {}
      let count = 0
      for (const { name, strokes } of extracted) {
        const playerName = matchScorecardName(name, playerNames)
        if (!playerName) continue
        const player = players.find((p) => p.name === playerName)
        if (player && !matched[player.id]) {
          matched[player.id] = String(strokes)
          count++
        }
      }

      if (count === 0) {
        toast.error('No scores matched — names on scorecard may differ from player list')
      } else {
        setScores((prev) => ({ ...prev, ...matched }))
        toast.success(`Filled ${count} of ${players.length} scores from scorecard`)
      }
    } catch (err) {
      toast.error('Scan failed: ' + (err instanceof Error ? err.message : String(err)))
    }
    setScanning(false)
  }

  const isScored = savedScores.some((s) => s.strokes != null)
  const sortedScores = [...savedScores].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))

  if (!round) return (
    <div style={{ padding: 24, color: 'var(--ink-soft)', fontSize: 14, textAlign: 'center' }}>Loading…</div>
  )

  const roundDate = new Date(round.date + 'T12:00:00')

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
            {roundDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()}
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
            {groups.map((g) => (
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
                  {g.members.map((m) => (
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
          {/* Section header */}
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

          {/* Score rows */}
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
                onChange={(e) => session && setScores((prev) => ({ ...prev, [p.id]: e.target.value }))}
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

          {/* Save button */}
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

      {/* Results — broadcast dark mode */}
      {isScored && sortedScores.length > 0 && (
        <section style={{ background: 'var(--tour-navy)', paddingBottom: 8 }}>
          {/* Column header */}
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
            const player = players.find((p) => p.id === s.player_id)
            const isFirst = s.rank === 1
            const isSecond = s.rank === 2
            const isThird = s.rank === 3
            const rowBg = isFirst ? 'rgba(201,162,74,.15)' : 'transparent'
            return (
              <div
                key={s.id}
                style={{
                  display: 'grid', gridTemplateColumns: '34px 1fr 70px 70px',
                  alignItems: 'center', height: 52, padding: '0 14px',
                  background: rowBg, color: '#F5EFE0',
                  borderBottom: '1px solid rgba(255,255,255,.06)',
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
