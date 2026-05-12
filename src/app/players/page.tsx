'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/lib/database.types'
import { toast } from 'sonner'
import { Camera, Search, X, Plus, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const ADMIN_EMAIL = 'ponhak@gmail.com'

function PlayerAvatar({ url, initials, size = 48 }: { url: string | null; initials: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={initials}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--tour-navy)', color: '#F5EFE0',
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: size * 0.38, letterSpacing: '.04em',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {initials}
    </div>
  )
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function PlayersPage() {
  const { session } = useAuth()
  const router = useRouter()
  const isAdmin = session?.user.email === ADMIN_EMAIL

  const [players, setPlayers] = useState<Player[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const [hcpEdits, setHcpEdits] = useState<Record<string, string>>({})
  const [savingHcp, setSavingHcp] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    const { data, error } = await db.from('players').select('*').order('name')
    if (error) { toast.error('Failed to load players'); return }
    const list = (data as Player[]) ?? []
    setPlayers(list)
    const map: Record<string, string> = {}
    list.forEach(p => { map[p.id] = p.hcp != null ? String(p.hcp) : '' })
    setHcpEdits(map)
    setLoading(false)
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    const { error } = await db.from('players').insert({ name })
    if (error) {
      toast.error('Failed to add player')
    } else {
      toast.success(`${name} added!`)
      setNewName('')
      setShowAdd(false)
      await loadPlayers()
    }
    setAdding(false)
  }

  async function deletePlayer(player: Player) {
    if (!confirm(`Remove ${player.name} from the roster?`)) return
    const { error } = await db.from('players').delete().eq('id', player.id)
    if (error) {
      toast.error('Failed to remove player')
    } else {
      toast.success(`${player.name} removed`)
      await loadPlayers()
    }
  }

  function triggerAvatarUpload(playerId: string) {
    setUploadingFor(playerId)
    fileInputRef.current?.click()
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !uploadingFor) return

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${uploadingFor}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('player-avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploadingFor(null); return }

    const { data: { publicUrl } } = supabase.storage
      .from('player-avatars')
      .getPublicUrl(path)

    const { error } = await db.from('players').update({ avatar_url: publicUrl }).eq('id', uploadingFor)
    if (error) {
      toast.error('Failed to save photo')
    } else {
      toast.success('Photo updated!')
      await loadPlayers()
    }
    setUploadingFor(null)
  }

  async function saveHcp(playerId: string) {
    const raw = hcpEdits[playerId] ?? ''
    const hcp = raw === '' ? null : Number(raw)
    if (raw !== '' && isNaN(hcp as number)) return
    setSavingHcp(playerId)
    const { error } = await db.from('players').update({ hcp }).eq('id', playerId)
    if (error) toast.error('Failed to save HCP')
    else await loadPlayers()
    setSavingHcp(null)
  }

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div style={{ background: 'var(--bunker-sand)', minHeight: '100%' }}>

      {/* Admin back button */}
      {isAdmin && (
        <div style={{
          background: 'var(--tour-navy)',
          padding: '14px 16px 12px',
          borderBottom: '2px solid var(--trophy-gold)',
        }}>
          <button
            onClick={() => router.push('/admin')}
            style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', padding: 0, marginBottom: 8 }}
          >
            <ChevronLeft size={14} strokeWidth={2.5} /> Admin
          </button>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>
            Field
          </div>
        </div>
      )}

      {/* Search bar */}
      <div style={{
        padding: '14px 16px',
        background: '#fff',
        borderBottom: '1px solid var(--bunker-sand-deep)',
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={18} strokeWidth={2}
            color="var(--ink-faint)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the field"
            style={{
              width: '100%', height: 44, paddingLeft: 40, paddingRight: 12,
              borderRadius: 8, border: '1px solid var(--bunker-sand-deep)',
              background: 'var(--bunker-sand)', color: 'var(--ink)',
              fontFamily: 'var(--font-body)', fontSize: 15, boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
        {session && (
          <button
            onClick={() => setShowAdd(v => !v)}
            style={{
              width: 44, height: 44, borderRadius: 8, flexShrink: 0,
              background: showAdd ? 'var(--tour-navy-soft)' : 'var(--tour-navy)',
              border: 0, color: '#F5EFE0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label={showAdd ? 'Cancel' : 'Add player'}
          >
            {showAdd ? <X size={18} strokeWidth={2} /> : <Plus size={18} strokeWidth={2} />}
          </button>
        )}
      </div>

      {/* Add player form */}
      {session && showAdd && (
        <form
          onSubmit={addPlayer}
          style={{
            padding: '14px 16px',
            background: '#fff',
            borderBottom: '1px solid var(--bunker-sand-deep)',
            display: 'flex', gap: 10,
          }}
        >
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Player name"
            maxLength={50}
            autoFocus
            style={{
              flex: 1, height: 44, padding: '0 14px',
              borderRadius: 8, border: '1.5px solid var(--tour-navy)',
              background: '#fff', color: 'var(--ink)',
              fontFamily: 'var(--font-body)', fontSize: 15, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            style={{
              height: 44, padding: '0 20px',
              borderRadius: 8, border: 0,
              background: adding || !newName.trim() ? '#ccc' : 'var(--tour-navy)',
              color: '#F5EFE0',
              fontFamily: 'var(--font-body)', fontWeight: 700,
              fontSize: 14, letterSpacing: '.04em',
              cursor: adding || !newName.trim() ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}

      {/* Hidden file input for avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarFile}
      />

      {/* Player grid */}
      <section style={{ padding: '16px' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          The Field · {filtered.length} player{filtered.length !== 1 ? 's' : ''}
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14 }}>
            {players.length === 0
              ? 'No players yet. Tap + to add your first player.'
              : 'No players match your search.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {filtered.map(p => {
              const isUploading = uploadingFor === p.id
              return (
                <div
                  key={p.id}
                  style={{
                    background: '#fff',
                    border: '1px solid var(--bunker-sand-deep)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-card)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {/* Avatar area */}
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '16px 16px 10px' }}>
                    <div
                      onClick={() => isAdmin && triggerAvatarUpload(p.id)}
                      style={{ position: 'relative', cursor: isAdmin ? 'pointer' : 'default' }}
                    >
                      <PlayerAvatar url={p.avatar_url ?? null} initials={getInitials(p.name)} size={72} />
                      {isAdmin && (
                        <div style={{
                          position: 'absolute', bottom: 0, right: 0,
                          width: 22, height: 22, borderRadius: '50%',
                          background: isUploading ? 'var(--ink-faint)' : 'var(--tour-navy)',
                          border: '2px solid #fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Camera size={11} color="#fff" strokeWidth={2} />
                        </div>
                      )}
                    </div>
                    {/* Delete button top-right */}
                    {isAdmin && (
                      <button
                        onClick={() => deletePlayer(p)}
                        style={{
                          position: 'absolute', top: 10, right: 10,
                          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                          background: 'transparent', border: '1px solid var(--bunker-sand-deep)',
                          color: 'var(--ink-faint)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        aria-label={`Remove ${p.name}`}
                      >
                        <X size={13} strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  {/* Name */}
                  <div style={{ textAlign: 'center', padding: '0 12px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>
                  </div>

                  {/* HCP row (admin only) */}
                  {isAdmin ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                        HCP
                      </span>
                      <input
                        type="number"
                        min={0} max={54} step={0.1}
                        value={hcpEdits[p.id] ?? ''}
                        onChange={e => setHcpEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                        onBlur={() => saveHcp(p.id)}
                        placeholder="—"
                        disabled={savingHcp === p.id}
                        style={{
                          width: 54, height: 28, textAlign: 'center',
                          borderRadius: 6, border: '1px solid var(--bunker-sand-deep)',
                          background: hcpEdits[p.id] ? 'var(--tour-navy)' : 'var(--bunker-sand)',
                          color: hcpEdits[p.id] ? '#F5EFE0' : 'var(--ink)',
                          fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14,
                          outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ height: 12 }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
