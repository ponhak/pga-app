'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { ShieldCheck, ChevronLeft, Plus, ChevronRight, Pencil, Trash2, X, Check, ScanLine, Loader2 } from 'lucide-react'
import type { Round, Player, Score } from '@/lib/database.types'
import { assignPoints } from '@/lib/points'
import Link from 'next/link'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ── OCR helpers (same logic as rounds/[id]/page.tsx) ─────────────────────────

const BASE_NICKNAMES: Record<string, string[]> = {
  bulan: ['kristoffer'],
  champ: ['nicklas'],
  hasse: ['hans'],
  nygren: ['niclas'],
}

function parseGolfGameBook(ocrText: string): { name: string; strokes: number; hcp: number | null; netDiff: number | null }[] {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean)
  const skipRe        = /slagspel|poangbogey|resultat|spelat|leaderboard|spelinfo|spelflode|johannesberg|donald|steel|\bbook\b|\bgame\b/i
  const standaloneHcpRe = /^HCP\s*(\d+)$/i
  const nameOnlyRe    = /^[A-Za-zÅÄÖåäöÉéÜü\s\-]{3,}$/
  const scoreReHcp    = /HCP\s*(\d+)\s*[^\d\s]?\s*(\d{1,3})\s+([+\-]?\d+)/i
  const scoreReNoHcp  = /(\d{2,3})\s+([+\-]?\d+)/i

  interface NameEntry  { idx: number; text: string; claimed: boolean }
  interface HcpEntry   { idx: number; val: number;  claimed: boolean }
  interface ScoreEntry { idx: number; hcp: number | null; strokes: number; netDiff: number | null; line: string }

  const nameEntries:  NameEntry[]  = []
  const hcpEntries:   HcpEntry[]   = []
  const scoreEntries: ScoreEntry[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^#/.test(line) || skipRe.test(line)) continue
    const hcpOnly = line.match(standaloneHcpRe)
    if (hcpOnly) { hcpEntries.push({ idx: i, val: Number(hcpOnly[1]), claimed: false }); continue }
    const mHcp = line.match(scoreReHcp)
    if (mHcp) { scoreEntries.push({ idx: i, hcp: Number(mHcp[1]), strokes: Number(mHcp[2]), netDiff: Number(mHcp[3]), line }); continue }
    const mNoHcp = line.match(scoreReNoHcp)
    if (mNoHcp) { scoreEntries.push({ idx: i, hcp: null, strokes: Number(mNoHcp[1]), netDiff: Number(mNoHcp[2]), line }); continue }
    if (nameOnlyRe.test(line)) nameEntries.push({ idx: i, text: line, claimed: false })
  }

  const paired: { name: string; strokes: number; hcp: number | null; netDiff: number | null }[] = []
  for (const score of scoreEntries) {
    let name: string | null = null
    let bestNameEntry: NameEntry | null = null
    for (const n of nameEntries) {
      if (n.claimed || n.idx >= score.idx) continue
      if (!bestNameEntry || n.idx > bestNameEntry.idx) bestNameEntry = n
    }
    if (bestNameEntry) { name = bestNameEntry.text; bestNameEntry.claimed = true }
    else {
      name = score.line.replace(/^\d+[.\)\s]\s*/, '').replace(/HCP\s*\d+/gi, '').replace(/\d{1,3}\s+[+\-]?\d+.*$/, '').replace(/\s+/g, ' ').trim()
      if (!name || name.length < 2 || /\d/.test(name)) name = null
    }
    let hcp = score.hcp
    if (hcp == null) {
      let bestHcp: HcpEntry | null = null
      for (const h of hcpEntries) {
        if (h.claimed || Math.abs(h.idx - score.idx) > 2) continue
        if (!bestHcp || Math.abs(h.idx - score.idx) < Math.abs(bestHcp.idx - score.idx)) bestHcp = h
      }
      if (bestHcp) { hcp = bestHcp.val; bestHcp.claimed = true }
    }
    if (name) paired.push({ name, strokes: score.strokes, hcp, netDiff: score.netDiff })
  }

  const parVotes: Record<number, number> = {}
  for (const r of paired) {
    if (r.strokes >= 55 && r.strokes <= 160 && r.netDiff != null) {
      const p = r.strokes - r.netDiff
      parVotes[p] = (parVotes[p] ?? 0) + 1
    }
  }
  const inferredPar = Object.keys(parVotes).length > 0
    ? Number(Object.entries(parVotes).sort(([, a], [, b]) => b - a)[0][0])
    : null

  return paired.map(r => {
    let strokes = r.strokes
    if ((strokes < 55 || strokes > 160) && r.netDiff != null && inferredPar != null) {
      const recovered = inferredPar + r.netDiff
      if (recovered >= 55 && recovered <= 160) strokes = recovered
    }
    const netDiff = inferredPar != null ? strokes - inferredPar : r.netDiff
    return { ...r, strokes, netDiff }
  }).filter(r => r.strokes >= 55 && r.strokes <= 160)
}

function matchOcrName(scorecardName: string, playerNames: string[], nicknames: Record<string, string[]>): string | null {
  const scWords = scorecardName.toLowerCase().split(/\s+/)
  for (const pName of playerNames) {
    const pWords = pName.toLowerCase().split(/\s+/)
    for (const sc of scWords) {
      for (const pw of pWords) {
        if (sc === pw) return pName
        if ((nicknames[pw] ?? []).includes(sc)) return pName
        if ((nicknames[sc] ?? []).includes(pw)) return pName
      }
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────

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

  // Inline edit for any round
  const [editId, setEditId]             = useState<string | null>(null)
  const [editDate, setEditDate]         = useState('')
  const [editVenue, setEditVenue]       = useState('')
  const [editSaving, setEditSaving]     = useState(false)
  const [editRoundPlayers, setEditRoundPlayers] = useState<Player[]>([])
  const [editRoundScores, setEditRoundScores]   = useState<Record<string, string>>({})
  const [editNetDiff, setEditNetDiff]           = useState<Record<string, string>>({})
  const [editGrossScores, setEditGrossScores]   = useState<Record<string, string>>({})
  const [editScoreSaving, setEditScoreSaving]   = useState(false)
  const [editScanning, setEditScanning]         = useState(false)
  const editFileRef = useRef<HTMLInputElement>(null)

  // Historical round form
  const [showHist, setShowHist]     = useState(false)
  const [histDate, setHistDate]     = useState('')
  const [histVenue, setHistVenue]   = useState('')
  const [histScores, setHistScores] = useState<Record<string, string>>({})
  const [histNetDiff, setHistNetDiff] = useState<Record<string, string>>({})
  const [histGrossScores, setHistGrossScores] = useState<Record<string, string>>({})
  const [histSaving, setHistSaving] = useState(false)
  const [histScanning, setHistScanning] = useState(false)
  const histFileRef = useRef<HTMLInputElement>(null)

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
    setEditNetDiff({})
    setEditGrossScores({})

    const [{ data: rpData }, { data: scoreData }] = await Promise.all([
      db.from('round_players').select('player_id, players(*)').eq('round_id', r.id),
      db.from('scores').select('*').eq('round_id', r.id),
    ])
    const rp = (rpData as { player_id: string; players: Player }[]) ?? []
    setEditRoundPlayers(rp.map(x => x.players).sort((a, b) => a.name.localeCompare(b.name)))

    const sc: Record<string, string> = {}
    const nd: Record<string, string> = {}
    const gs: Record<string, string> = {}
    for (const s of (scoreData as Score[]) ?? []) {
      if (s.strokes != null) sc[s.player_id] = String(s.strokes)
      if (s.net_diff != null) nd[s.player_id] = String(s.net_diff)
      if (s.gross_strokes != null) gs[s.player_id] = String(s.gross_strokes)
    }
    setEditRoundScores(sc)
    setEditNetDiff(nd)
    setEditGrossScores(gs)
  }

  async function saveEditScores() {
    if (!editId) return
    const entries = editRoundPlayers
      .filter(p => editRoundScores[p.id]?.trim() !== '' && editRoundScores[p.id] != null)
      .map(p => ({ playerId: p.id, name: p.name, strokes: parseInt(editRoundScores[p.id]) }))
      .filter(s => !isNaN(s.strokes) && s.strokes > 0)

    const invalid = entries.filter(s => s.strokes < 50 || s.strokes > 160)
    if (invalid.length > 0) {
      toast.error(`Invalid score for ${invalid.map(s => s.name).join(', ')} — must be 50–160`)
      return
    }

    if (entries.length < 2) { toast.error('Enter at least 2 net scores'); return }

    setEditScoreSaving(true)
    const withGross = entries.map(({ playerId, strokes }) => {
      const gs = editGrossScores[playerId]?.trim()
      const grossStrokes = gs != null && gs !== '' ? parseInt(gs) : undefined
      return { playerId, strokes, grossStrokes }
    })
    const results = assignPoints(withGross)
    const upserts = results.map(r => {
      const nd = editNetDiff[r.playerId]?.trim()
      const gs = editGrossScores[r.playerId]?.trim()
      return {
        round_id:      editId,
        player_id:     r.playerId,
        strokes:       r.strokes,
        gross_strokes: gs != null && gs !== '' ? parseInt(gs) : null,
        net_diff:      nd !== '' && nd != null ? parseInt(nd) : null,
        points_earned: r.points,
        rank:          r.rank,
      }
    })
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

    const scoreInputsRaw = players
      .filter(p => histScores[p.id]?.trim() !== '' && histScores[p.id] != null)
      .map(p => ({ playerId: p.id, name: p.name, strokes: parseInt(histScores[p.id]) }))
      .filter(s => !isNaN(s.strokes) && s.strokes > 0)

    const invalidHist = scoreInputsRaw.filter(s => s.strokes < 50 || s.strokes > 160)
    if (invalidHist.length > 0) {
      toast.error(`Invalid score for ${invalidHist.map(s => s.name).join(', ')} — must be 50–160`)
      return
    }

    const scoreInputs = scoreInputsRaw.map(({ playerId, strokes }) => ({ playerId, strokes }))

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

    const withGross = scoreInputs.map(({ playerId, strokes }) => {
      const gs = histGrossScores[playerId]?.trim()
      const grossStrokes = gs != null && gs !== '' ? parseInt(gs) : undefined
      return { playerId, strokes, grossStrokes }
    })
    const results = assignPoints(withGross)

    await db.from('round_players').insert(
      results.map(r => ({ round_id: newRound.id, player_id: r.playerId }))
    )

    const { error: scoreErr } = await db.from('scores').insert(
      results.map(r => {
        const nd = histNetDiff[r.playerId]?.trim()
        const gs = histGrossScores[r.playerId]?.trim()
        return {
          round_id:      newRound.id,
          player_id:     r.playerId,
          strokes:       r.strokes,
          gross_strokes: gs != null && gs !== '' ? parseInt(gs) : null,
          net_diff:      nd !== '' && nd != null ? parseInt(nd) : null,
          points_earned: r.points,
          rank:          r.rank,
        }
      })
    )

    if (scoreErr) {
      toast.error(scoreErr.message)
    } else {
      toast.success('Historical round saved')
      setShowHist(false)
      setHistDate('')
      setHistVenue('')
      setHistScores({})
      setHistNetDiff({})
      setHistGrossScores({})
      await loadAll()
    }
    setHistSaving(false)
  }

  // ── OCR scan ─────────────────────────────────────────────────────────────

  function buildNicknames(): Record<string, string[]> {
    const map: Record<string, string[]> = { ...BASE_NICKNAMES }
    for (const p of players) {
      const aliases = p.nicknames ?? []
      const realWords = p.name.toLowerCase().split(/\s+/)
      for (const alias of aliases) {
        const key = alias.toLowerCase()
        map[key] = [...(map[key] ?? []), ...realWords]
      }
    }
    return map
  }

  async function runOcr(
    file: File,
    playerList: Player[],
    setNet: (fn: (p: Record<string, string>) => Record<string, string>) => void,
    setNd: (fn: (p: Record<string, string>) => Record<string, string>) => void,
    setGs: (fn: (p: Record<string, string>) => Record<string, string>) => void,
    setScanning: (v: boolean) => void,
  ) {
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
      const nicknames = buildNicknames()
      const pNames = playerList.map(p => p.name)

      const net: Record<string, string> = {}
      const nd: Record<string, string>  = {}
      const gs: Record<string, string>  = {}
      const unmatched: string[] = []
      let count = 0

      for (const { name, strokes, hcp, netDiff } of extracted) {
        const pName = matchOcrName(name, pNames, nicknames)
        if (!pName) { unmatched.push(`${name}(${strokes})`); continue }
        const player = playerList.find(p => p.name === pName)
        if (player && !net[player.id]) {
          net[player.id] = String(strokes)
          if (netDiff != null) nd[player.id] = String(netDiff)
          if (hcp != null) gs[player.id] = String(strokes + hcp)
          count++
        }
      }

      if (count === 0) {
        const summary = extracted.map(e => `${e.name}=${e.strokes}`).join(' | ')
        toast.error(extracted.length ? `No names matched. Parsed: ${summary}` : `Nothing parsed from image`, { duration: 12000 })
      } else {
        setNet(prev => ({ ...prev, ...net }))
        setNd(prev => ({ ...prev, ...nd }))
        setGs(prev => ({ ...prev, ...gs }))
        const summary = extracted.map(e => `${e.name}=${e.strokes}`).join(' | ')
        const detail = unmatched.length ? ` | Unmatched: ${unmatched.join(', ')}` : ''
        toast.success(`Filled ${count}/${playerList.length} | ${summary}${detail}`, { duration: 12000 })
      }
    } catch (err) {
      toast.error('Scan failed: ' + (err instanceof Error ? err.message : String(err)))
    }
    setScanning(false)
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Scores</span>
                            <button type="button" onClick={() => editFileRef.current?.click()} disabled={editScanning}
                              style={{ height: 30, padding: '0 10px', borderRadius: 6, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: editScanning ? 'var(--ink-faint)' : 'var(--ink)', cursor: editScanning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                              {editScanning ? <Loader2 size={12} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> : <ScanLine size={12} strokeWidth={2} />}
                              {editScanning ? 'Scanning…' : 'Scan Scorecard'}
                            </button>
                            <input ref={editFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) runOcr(f, editRoundPlayers, setEditRoundScores, setEditNetDiff, setEditGrossScores, setEditScanning) }} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 64px 64px', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Player</span>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)', textAlign: 'center' }}>Net</span>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)', textAlign: 'center' }}>+/−</span>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)', textAlign: 'center' }}>Gross</span>
                          </div>
                          {editRoundPlayers.map(p => (
                            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 64px 64px', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{p.name}</span>
                              <input type="number" min={40} max={130}
                                value={editRoundScores[p.id] ?? ''}
                                onChange={e => setEditRoundScores(prev => ({ ...prev, [p.id]: e.target.value }))}
                                placeholder="—"
                                style={{ width: '100%', height: 38, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
                              <input type="number" min={-50} max={50}
                                value={editNetDiff[p.id] ?? ''}
                                onChange={e => setEditNetDiff(prev => ({ ...prev, [p.id]: e.target.value }))}
                                placeholder="—"
                                style={{ width: '100%', height: 38, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
                              <input type="number" min={40} max={200}
                                value={editGrossScores[p.id] ?? ''}
                                onChange={e => setEditGrossScores(prev => ({ ...prev, [p.id]: e.target.value }))}
                                placeholder="—"
                                style={{ width: '100%', height: 38, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={label({ marginBottom: 0 })}>Scores (leave Net blank to exclude a player)</label>
                    <button type="button" onClick={() => histFileRef.current?.click()} disabled={histScanning}
                      style={{ height: 30, padding: '0 10px', borderRadius: 6, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: histScanning ? 'var(--ink-faint)' : 'var(--ink)', cursor: histScanning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                      {histScanning ? <Loader2 size={12} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> : <ScanLine size={12} strokeWidth={2} />}
                      {histScanning ? 'Scanning…' : 'Scan'}
                    </button>
                    <input ref={histFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) runOcr(f, players, setHistScores, setHistNetDiff, setHistGrossScores, setHistScanning) }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 64px 64px', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Player</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)', textAlign: 'center' }}>Net</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)', textAlign: 'center' }}>+/−</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)', textAlign: 'center' }}>Gross</span>
                    </div>
                    {players.map(p => (
                      <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 64px 64px', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{p.name}</span>
                        <input type="number" min={40} max={130}
                          value={histScores[p.id] ?? ''}
                          onChange={e => setHistScores(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="—"
                          style={{ width: '100%', height: 40, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
                        <input type="number" min={-50} max={50}
                          value={histNetDiff[p.id] ?? ''}
                          onChange={e => setHistNetDiff(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="—"
                          style={{ width: '100%', height: 40, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
                        <input type="number" min={40} max={200}
                          value={histGrossScores[p.id] ?? ''}
                          onChange={e => setHistGrossScores(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="—"
                          style={{ width: '100%', height: 40, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
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
                      <div key={r.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none' }}>
                        {editId === r.id ? (
                          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Edit Round</span>
                              <button type="button" onClick={() => setEditId(null)} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink-faint)', padding: 4 }}>
                                <X size={16} strokeWidth={2} />
                              </button>
                            </div>
                            <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div>
                                  <label style={label({ fontSize: 10 })}>Date</label>
                                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} max={today} required style={textInput({ height: 40, fontSize: 14 })} />
                                </div>
                                <div>
                                  <label style={label({ fontSize: 10 })}>Venue</label>
                                  <input type="text" value={editVenue} onChange={e => setEditVenue(e.target.value)} placeholder="e.g. Schager GK" style={textInput({ height: 40, fontSize: 14 })} />
                                </div>
                              </div>
                              <button type="submit" disabled={editSaving} style={{ height: 38, borderRadius: 8, border: 0, background: editSaving ? '#ccc' : 'var(--tour-navy)', color: '#F5EFE0', fontWeight: 700, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', cursor: editSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <Check size={14} strokeWidth={2.5} /> {editSaving ? 'Saving…' : 'Save Details'}
                              </button>
                            </form>
                            {editRoundPlayers.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ height: 1, background: 'var(--bunker-sand-deep)' }} />
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Scores</span>
                                  <button type="button" onClick={() => editFileRef.current?.click()} disabled={editScanning}
                                    style={{ height: 28, padding: '0 8px', borderRadius: 6, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: editScanning ? 'var(--ink-faint)' : 'var(--ink)', cursor: editScanning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                                    {editScanning ? <Loader2 size={11} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} /> : <ScanLine size={11} strokeWidth={2} />}
                                    {editScanning ? 'Scanning…' : 'Scan'}
                                  </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 64px 64px', gap: 8, alignItems: 'center' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Player</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)', textAlign: 'center' }}>Net</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)', textAlign: 'center' }}>+/−</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-soft)', textAlign: 'center' }}>Gross</span>
                                </div>
                                {editRoundPlayers.map(p => (
                                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 64px 64px', gap: 8, alignItems: 'center' }}>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{p.name}</span>
                                    <input type="number" min={40} max={130} value={editRoundScores[p.id] ?? ''} onChange={e => setEditRoundScores(prev => ({ ...prev, [p.id]: e.target.value }))} placeholder="—" style={{ width: '100%', height: 38, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
                                    <input type="number" min={-50} max={50} value={editNetDiff[p.id] ?? ''} onChange={e => setEditNetDiff(prev => ({ ...prev, [p.id]: e.target.value }))} placeholder="—" style={{ width: '100%', height: 38, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
                                    <input type="number" min={40} max={200} value={editGrossScores[p.id] ?? ''} onChange={e => setEditGrossScores(prev => ({ ...prev, [p.id]: e.target.value }))} placeholder="—" style={{ width: '100%', height: 38, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }} />
                                  </div>
                                ))}
                                <button onClick={saveEditScores} disabled={editScoreSaving} style={{ height: 38, borderRadius: 8, border: 0, background: editScoreSaving ? '#ccc' : 'var(--fairway-green)', color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', cursor: editScoreSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                  <Check size={14} strokeWidth={2.5} /> {editScoreSaving ? 'Saving…' : 'Save & Recalculate Points'}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
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
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
