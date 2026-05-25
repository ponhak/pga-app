'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/lib/database.types'
import { toast } from 'sonner'
import { Camera, Search, X, Plus, ChevronLeft, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ADMIN_EMAIL } from '@/lib/auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface MemberInfo {
  email: string
  is_admin: boolean
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-label={on ? 'Revoke admin' : 'Grant admin'}
      style={{
        width: 44, height: 26, borderRadius: 999, border: 0,
        background: on ? 'var(--fairway-green)' : 'var(--bunker-sand-deep)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        position: 'relative', flexShrink: 0,
        transition: 'background .18s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        transition: 'left .18s', display: 'block',
      }} />
    </button>
  )
}

export default function FieldPage() {
  const { session, loading, isAdmin } = useAuth()
  const router = useRouter()

  const [players, setPlayers] = useState<Player[]>([])
  const [newName, setNewName] = useState('')
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [hcpEdits, setHcpEdits] = useState<Record<string, string>>({})
  const [savingHcp, setSavingHcp] = useState<string | null>(null)
  const [nicknameEdits, setNicknameEdits] = useState<Record<string, string>>({})
  const [savingNicknames, setSavingNicknames] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  // name (lowercase) → { email, is_admin }
  const [memberByName, setMemberByName] = useState<Record<string, MemberInfo>>({})
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) { loadPlayers(); loadMemberMap() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function loadPlayers() {
    const { data, error } = await db.from('players').select('*').order('name')
    if (error) { toast.error('Failed to load players'); return }
    const list = (data as Player[]) ?? []
    setPlayers(list)
    const hcpMap: Record<string, string> = {}
    const nickMap: Record<string, string> = {}
    list.forEach((p: Player) => {
      hcpMap[p.id] = p.hcp != null ? String(p.hcp) : ''
      nickMap[p.id] = ''
    })
    setHcpEdits(hcpMap)
    setNicknameEdits(nickMap)
    setLoadingPlayers(false)
  }

  async function loadMemberMap() {
    const [{ data: blocks }, { data: profiles }, { data: emailData }] = await Promise.all([
      db.from('availability_blocks').select('user_id, user_email'),
      db.from('profiles').select('id, name'),
      db.from('allowed_emails').select('email, is_admin'),
    ])

    // email → is_admin
    const adminByEmail: Record<string, boolean> = {}
    for (const e of (emailData ?? [])) adminByEmail[e.email] = e.is_admin

    // user_id → email (from blocks, first occurrence)
    const emailByUserId: Record<string, string> = {}
    for (const b of (blocks ?? [])) if (!emailByUserId[b.user_id]) emailByUserId[b.user_id] = b.user_email

    // name (lower) → { email, is_admin }
    const map: Record<string, MemberInfo> = {}
    for (const p of (profiles ?? [])) {
      const email = emailByUserId[p.id]
      if (email && p.name && adminByEmail[email] !== undefined) {
        map[p.name.toLowerCase()] = { email, is_admin: adminByEmail[email] }
      }
    }
    setMemberByName(map)
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    const { error } = await db.from('players').insert({ name })
    if (error) { toast.error('Failed to add player') }
    else { toast.success(`${name} added!`); setNewName(''); setShowAdd(false); await loadPlayers() }
    setAdding(false)
  }

  async function deletePlayer(player: Player) {
    if (!confirm(`Remove ${player.name} from the roster?`)) return
    const { error } = await db.from('players').delete().eq('id', player.id)
    if (error) { toast.error('Failed to remove player') }
    else { toast.success(`${player.name} removed`); await loadPlayers() }
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
    const { error: uploadError } = await supabase.storage.from('player-avatars').upload(path, file, { upsert: true })
    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploadingFor(null); return }
    const { data: { publicUrl } } = supabase.storage.from('player-avatars').getPublicUrl(path)
    const { error } = await db.from('players').update({ avatar_url: publicUrl }).eq('id', uploadingFor)
    if (error) { toast.error('Failed to save photo') }
    else { toast.success('Photo updated!'); await loadPlayers() }
    setUploadingFor(null)
  }

  async function addAlias(playerId: string, raw: string) {
    const alias = raw.trim().toLowerCase()
    if (!alias) return
    const existing = players.find(p => p.id === playerId)?.nicknames ?? []
    if (existing.includes(alias)) { setNicknameEdits(prev => ({ ...prev, [playerId]: '' })); return }
    setSavingNicknames(playerId)
    const { error } = await db.from('players').update({ nicknames: [...existing, alias] }).eq('id', playerId)
    if (error) toast.error('Failed to save alias')
    else { setNicknameEdits(prev => ({ ...prev, [playerId]: '' })); await loadPlayers() }
    setSavingNicknames(null)
  }

  async function removeAlias(playerId: string, alias: string) {
    const existing = players.find(p => p.id === playerId)?.nicknames ?? []
    setSavingNicknames(playerId)
    const { error } = await db.from('players').update({ nicknames: existing.filter(n => n !== alias) }).eq('id', playerId)
    if (error) toast.error('Failed to remove alias')
    else await loadPlayers()
    setSavingNicknames(null)
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

  async function toggleAdmin(email: string, current: boolean) {
    if (email === ADMIN_EMAIL) return
    setToggling(email)
    const { error, count } = await db
      .from('allowed_emails').update({ is_admin: !current }).eq('email', email)
      .select('email', { count: 'exact', head: true })
    if (error) { toast.error(error.message) }
    else if (count === 0) { toast.error('Permission denied — check Supabase RLS policies') }
    else { toast.success(`${email} is ${!current ? 'now an admin' : 'no longer an admin'}`); await loadMemberMap() }
    setToggling(null)
  }

  if (loading) return null

  if (!session || !isAdmin) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-soft)' }}>
        <ShieldCheck size={40} strokeWidth={1.5} style={{ margin: '0 auto 12px', color: 'var(--ink-faint)' }} />
        <p style={{ fontSize: 15 }}>Access denied.</p>
      </div>
    )
  }

  const filtered = players.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))

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
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--trophy-gold)', marginBottom: 4 }}>
          Admin
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>
          Field & Roles
        </div>
      </div>

      {/* Search + add */}
      <div style={{ padding: '20px 16px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} strokeWidth={2} color="var(--ink-faint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the field"
            style={{
              width: '100%', height: 44, paddingLeft: 40, paddingRight: 12,
              borderRadius: 8, border: '1px solid var(--bunker-sand-deep)',
              background: '#fff', color: 'var(--ink)',
              fontFamily: 'var(--font-body)', fontSize: 15, boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: showAdd ? 'var(--tour-navy-soft)' : 'var(--tour-navy)', border: 0, color: '#F5EFE0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label={showAdd ? 'Cancel' : 'Add player'}
        >
          {showAdd ? <X size={18} strokeWidth={2} /> : <Plus size={18} strokeWidth={2} />}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addPlayer} style={{ padding: '0 16px 12px', display: 'flex', gap: 10 }}>
          <input
            value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Player name" maxLength={50} autoFocus
            style={{ flex: 1, height: 44, padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--tour-navy)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
          />
          <button
            type="submit" disabled={adding || !newName.trim()}
            style={{ height: 44, padding: '0 20px', borderRadius: 8, border: 0, background: adding || !newName.trim() ? '#ccc' : 'var(--tour-navy)', color: '#F5EFE0', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, letterSpacing: '.04em', cursor: adding || !newName.trim() ? 'not-allowed' : 'pointer', textTransform: 'uppercase' }}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />

      <div style={{ padding: '0 16px 40px' }}>
        {loadingPlayers ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14 }}>
            {players.length === 0 ? 'No players yet. Tap + to add your first player.' : 'No players match your search.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ gap: 10 }}>
            {filtered.map(p => {
              const isUploading = uploadingFor === p.id
              const member = memberByName[p.name.toLowerCase()]
              const isSuperAdmin = member?.email === ADMIN_EMAIL
              return (
                <div key={p.id} style={{ background: '#fff', border: '1px solid var(--bunker-sand-deep)', borderRadius: 12, boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                  {/* Avatar */}
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '16px 16px 10px' }}>
                    <div onClick={() => triggerAvatarUpload(p.id)} style={{ position: 'relative', cursor: 'pointer' }}>
                      <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={72} />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: isUploading ? 'var(--ink-faint)' : 'var(--tour-navy)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Camera size={11} color="#fff" strokeWidth={2} />
                      </div>
                    </div>
                    <button
                      onClick={() => deletePlayer(p)}
                      style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 6, background: 'transparent', border: '1px solid var(--bunker-sand-deep)', color: 'var(--ink-faint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      aria-label={`Remove ${p.name}`}
                    >
                      <X size={13} strokeWidth={2} />
                    </button>
                  </div>

                  {/* Name */}
                  <div style={{ textAlign: 'center', padding: '0 12px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  </div>

                  {/* Account row (if member has account) */}
                  {member && (
                    <div style={{ margin: '8px 12px 0', padding: '8px 10px', borderRadius: 8, background: member.is_admin ? 'rgba(31,122,76,.07)' : 'var(--bunker-sand)', border: `1px solid ${member.is_admin ? 'rgba(31,122,76,.18)' : 'var(--bunker-sand-deep)'}` }}>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                        {member.email}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: member.is_admin ? 'var(--fairway-green)' : 'var(--ink-faint)' }}>
                          {isSuperAdmin ? 'Super admin' : member.is_admin ? 'Admin' : 'Member'}
                        </span>
                        <Toggle
                          on={member.is_admin}
                          disabled={isSuperAdmin || toggling === member.email}
                          onChange={() => toggleAdmin(member.email, member.is_admin)}
                        />
                      </div>
                    </div>
                  )}

                  {/* HCP + Aliases */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>HCP</span>
                      <input
                        type="number" min={0} max={54} step={0.1}
                        value={hcpEdits[p.id] ?? ''}
                        onChange={e => setHcpEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                        onBlur={() => saveHcp(p.id)}
                        placeholder="—" disabled={savingHcp === p.id}
                        style={{ width: 54, height: 28, textAlign: 'center', borderRadius: 6, border: '1px solid var(--bunker-sand-deep)', background: hcpEdits[p.id] ? 'var(--tour-navy)' : 'var(--bunker-sand)', color: hcpEdits[p.id] ? '#F5EFE0' : 'var(--ink)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)', textAlign: 'center' }}>OCR Aliases</span>
                      {(p.nicknames ?? []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                          {(p.nicknames ?? []).map(alias => (
                            <span key={alias} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 5px 3px 8px', borderRadius: 5, background: 'var(--tour-navy)', color: '#F5EFE0', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600 }}>
                              {alias}
                              <button onClick={() => removeAlias(p.id, alias)} disabled={savingNicknames === p.id} aria-label={`Remove alias ${alias}`} style={{ width: 14, height: 14, borderRadius: '50%', border: 0, background: 'rgba(255,255,255,.22)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
                                <X size={8} strokeWidth={3} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <input
                        type="text"
                        value={nicknameEdits[p.id] ?? ''}
                        onChange={e => setNicknameEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addAlias(p.id, nicknameEdits[p.id] ?? '') }}
                        onBlur={() => { if (nicknameEdits[p.id]?.trim()) addAlias(p.id, nicknameEdits[p.id] ?? '') }}
                        placeholder="+ add alias" disabled={savingNicknames === p.id}
                        style={{ width: '100%', height: 26, padding: '0 8px', textAlign: 'center', borderRadius: 6, border: '1px dashed var(--bunker-sand-deep)', background: 'transparent', color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)', fontSize: 10, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
