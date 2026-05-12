'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/lib/database.types'
import { toast } from 'sonner'
import { Search, X, Plus } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

function Avatar({ initials, size = 40 }: { initials: string; size?: number }) {
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

export default function PlayersPage() {
  const { session } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    const { data, error } = await supabase.from('players').select('*').order('name')
    if (error) { toast.error('Failed to load players'); return }
    setPlayers((data as Player[]) ?? [])
    setLoading(false)
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('players') as any).insert({ name })
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
    const { error } = await supabase.from('players').delete().eq('id', player.id)
    if (error) {
      toast.error('Failed to remove player')
    } else {
      toast.success(`${player.name} removed`)
      await loadPlayers()
    }
  }

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div style={{ background: 'var(--bunker-sand)', minHeight: '100%' }}>
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
            {filtered.map(p => (
              <div
                key={p.id}
                style={{
                  background: '#fff',
                  border: '1px solid var(--bunker-sand-deep)',
                  borderRadius: 12, padding: 12,
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex', alignItems: 'center', gap: 10, minWidth: 0,
                }}
              >
                <Avatar initials={getInitials(p.name)} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* Split name into first / last if space exists */}
                  {p.name.includes(' ') ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name.split(' ').slice(0, -1).join(' ')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name.split(' ').slice(-1)[0]}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{p.name}</div>
                  )}
                </div>
                {session && (
                  <button
                    onClick={() => deletePlayer(p)}
                    style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: 'transparent', border: '1px solid var(--bunker-sand-deep)',
                      color: 'var(--ink-faint)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label={`Remove ${p.name}`}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
