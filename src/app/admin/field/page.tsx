'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/lib/database.types'
import { toast } from 'sonner'
import { Camera, Search, X, Plus, ChevronLeft, ShieldCheck, ChevronDown } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ADMIN_EMAIL } from '@/lib/auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface MemberInfo {
  email: string
  is_admin: boolean
  last_seen_at: string | null
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-label={on ? 'Revoke admin' : 'Grant admin'}
      style={{
        width: 40, height: 22, borderRadius: 999, border: 0,
        background: on ? 'var(--fairway-green)' : 'var(--bunker-sand-deep)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        position: 'relative', flexShrink: 0,
        transition: 'background .18s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 19 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        transition: 'left .18s', display: 'block',
      }} />
    </button>
  )
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined })
}

export default function FieldPage() {
  const { session, loading, isAdmin } = useAuth()
  const router = useRouter()

  const [players, setPlayers] = useState<Player[]>([])
  const [allEmails, setAllEmails] = useState<string[]>([])
  const [memberByEmail, setMemberByEmail] = useState<Record<string, MemberInfo>>({})
  const [newName, setNewName] = useState('')
  const [loadingData, setLoadingData] = useState(true)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [hcpEdits, setHcpEdits] = useState<Record<string, string>>({})
  const [savingHcp, setSavingHcp] = useState<string | null>(null)
  const [nicknameEdits, setNicknameEdits] = useState<Record<string, string>>({})
  const [savingNicknames, setSavingNicknames] = useState<string | null>(null)
  const [savingEmail, setSavingEmail] = useState<string | null>(null)
  const [emailDropdownOpen, setEmailDropdownOpen] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function loadAll() {
    const [{ data: playersData }, { data: emailData }, { data: profilesData }] = await Promise.all([
      db.from('players').select('*').order('name'),
      db.from('allowed_emails').select('email, is_admin'),
      db.from('profiles').select('email, last_seen_at'),
    ])

    const list = (playersData as Player[]) ?? []
    setPlayers(list)
    const hcpMap: Record<string, string> = {}
    const nickMap: Record<string, string> = {}
    list.forEach((p: Player) => {
      hcpMap[p.id] = p.hcp != null ? String(p.hcp) : ''
      nickMap[p.id] = ''
    })
    setHcpEdits(hcpMap)
    setNicknameEdits(nickMap)

    // last_seen_at by email from profiles
    const lastSeenByEmail: Record<string, string | null> = {}
    for (const p of (profilesData ?? [])) {
      if (p.email) lastSeenByEmail[p.email] = p.last_seen_at ?? null
    }

    const emails: string[] = []
    const byEmail: Record<string, MemberInfo> = {}
    for (const e of (emailData ?? [])) {
      emails.push(e.email)
      byEmail[e.email] = { email: e.email, is_admin: e.is_admin, last_seen_at: lastSeenByEmail[e.email] ?? null }
    }
    setAllEmails(emails)
    setMemberByEmail(byEmail)
    setLoadingData(false)
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    const { error } = await db.from('players').insert({ name })
    if (error) { toast.error('Failed to add player') }
    else { toast.success(`${name} added!`); setNewName(''); setShowAdd(false); await loadAll() }
    setAdding(false)
  }

  async function deletePlayer(player: Player) {
    if (!confirm(`Remove ${player.name} from the roster?`)) return
    const { error } = await db.from('players').delete().eq('id', player.id)
    if (error) { toast.error('Failed to remove player') }
    else { toast.success(`${player.name} removed`); await loadAll() }
  }

  async function linkEmail(playerId: string, email: string | null) {
    setSavingEmail(playerId)
    const { error } = await db.from('players').update({ account_email: email }).eq('id', playerId)
    if (error) { toast.error('Failed to link account') }
    else { await loadAll() }
    setSavingEmail(null)
    setEmailDropdownOpen(null)
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
    const { error: uploadError } = await supabase.storage.from('players-avatars').upload(path, file, { upsert: true })
    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploadingFor(null); return }
    const { data: { publicUrl } } = supabase.storage.from('players-avatars').getPublicUrl(path)
    const { error } = await db.from('players').update({ avatar_url: publicUrl }).eq('id', uploadingFor)
    if (error) { toast.error('Failed to save photo') }
    else { toast.success('Photo updated!'); await loadAll() }
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
    else { setNicknameEdits(prev => ({ ...prev, [playerId]: '' })); await loadAll() }
    setSavingNicknames(null)
  }

  async function removeAlias(playerId: string, alias: string) {
    const existing = players.find(p => p.id === playerId)?.nicknames ?? []
    setSavingNicknames(playerId)
    const { error } = await db.from('players').update({ nicknames: existing.filter(n => n !== alias) }).eq('id', playerId)
    if (error) toast.error('Failed to remove alias')
    else await loadAll()
    setSavingNicknames(null)
  }

  async function saveHcp(playerId: string) {
    const raw = hcpEdits[playerId] ?? ''
    const hcp = raw === '' ? null : Number(raw)
    if (raw !== '' && isNaN(hcp as number)) return
    setSavingHcp(playerId)
    const { error } = await db.from('players').update({ hcp }).eq('id', playerId)
    if (error) toast.error('Failed to save HCP')
    else await loadAll()
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
    else { toast.success(`${email} is ${!current ? 'now an admin' : 'no longer an admin'}`); await loadAll() }
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
  const usedEmails = new Set(players.map(p => p.account_email).filter(Boolean))

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
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, textTransform: 'uppercase', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>Field & Roles</div>
      </div>

      {/* Search + add */}
      <div style={{ padding: '20px 16px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} strokeWidth={2} color="var(--ink-faint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the field"
            style={{ width: '100%', height: 44, paddingLeft: 40, paddingRight: 12, borderRadius: 8, border: '1px solid var(--bunker-sand-deep)', background: '#fff', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 15, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: showAdd ? 'var(--tour-navy-soft)' : 'var(--tour-navy)', border: 0, color: '#F5EFE0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {showAdd ? <X size={18} strokeWidth={2} /> : <Plus size={18} strokeWidth={2} />}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addPlayer} style={{ padding: '0 16px 12px', display: 'flex', gap: 10 }}>
          <input
            value={newName} onChange={e => setNewName(e.target.value)} placeholder="Player name" maxLength={50} autoFocus
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

      {/* Close dropdown backdrop */}
      {emailDropdownOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setEmailDropdownOpen(null)} />
      )}

      <div style={{ padding: '0 16px 40px' }}>
        {loadingData ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14 }}>
            {players.length === 0 ? 'No players yet. Tap + to add your first player.' : 'No players match your search.'}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid var(--bunker-sand-deep)', borderRadius: 12, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
            {filtered.map((p, idx) => {
              const isUploading = uploadingFor === p.id
              const member = p.account_email ? memberByEmail[p.account_email] : undefined
              const hasAccount = !!member
              const isSuperAdmin = member?.email === ADMIN_EMAIL
              const availableEmails = allEmails.filter(e => !usedEmails.has(e) || e === p.account_email)

              return (
                <div key={p.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--bunker-sand-deep)' : 'none', padding: '16px' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

                    {/* Avatar */}
                    <div onClick={() => triggerAvatarUpload(p.id)} style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                      <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={52} />
                      <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: isUploading ? 'var(--ink-faint)' : 'var(--tour-navy)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Camera size={9} color="#fff" strokeWidth={2} />
                      </div>
                    </div>

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>

                      {/* Name + status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{p.name}</span>
                        {hasAccount ? (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: 'rgba(31,122,76,.12)', color: 'var(--fairway-green)' }}>Active</span>
                        ) : (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: 'rgba(0,0,0,.06)', color: 'var(--ink-faint)' }}>No account</span>
                        )}
                      </div>

                      {/* Account email picker */}
                      <div style={{ position: 'relative', marginBottom: 6 }}>
                        <button
                          onClick={() => setEmailDropdownOpen(emailDropdownOpen === p.id ? null : p.id)}
                          disabled={savingEmail === p.id}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid var(--bunker-sand-deep)',
                            background: hasAccount ? 'rgba(31,122,76,.05)' : 'var(--bunker-sand)',
                            color: hasAccount ? 'var(--ink)' : 'var(--ink-faint)',
                            fontSize: 12, cursor: 'pointer', maxWidth: '100%',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.account_email ?? 'Link account…'}
                          </span>
                          <ChevronDown size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
                        </button>
                        {emailDropdownOpen === p.id && (
                          <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 10, background: '#fff', border: '1px solid var(--bunker-sand-deep)', borderRadius: 8, boxShadow: 'var(--shadow-pop)', minWidth: 220, overflow: 'hidden' }}>
                            {p.account_email && (
                              <button
                                onClick={() => linkEmail(p.id, null)}
                                style={{ width: '100%', padding: '10px 14px', textAlign: 'left', border: 0, borderBottom: '1px solid var(--bunker-sand-deep)', background: 'transparent', color: 'var(--tournament-red)', fontSize: 13, cursor: 'pointer' }}
                              >
                                Unlink account
                              </button>
                            )}
                            {availableEmails.length === 0 ? (
                              <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--ink-faint)' }}>No unlinked accounts</div>
                            ) : availableEmails.map(email => (
                              <button
                                key={email}
                                onClick={() => linkEmail(p.id, email)}
                                style={{ width: '100%', padding: '10px 14px', textAlign: 'left', border: 0, borderBottom: '1px solid var(--bunker-sand-deep)', background: email === p.account_email ? 'rgba(31,122,76,.07)' : 'transparent', color: 'var(--ink)', fontSize: 13, cursor: 'pointer' }}
                              >
                                {email}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Last seen + HCP */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                        {hasAccount && (
                          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                            Last seen: <strong>{formatLastSeen(member!.last_seen_at)}</strong>
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>HCP</span>
                          <input
                            type="number" min={0} max={54} step={0.1}
                            value={hcpEdits[p.id] ?? ''}
                            onChange={e => setHcpEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                            onBlur={() => saveHcp(p.id)}
                            placeholder="—" disabled={savingHcp === p.id}
                            style={{ width: 48, height: 24, textAlign: 'center', borderRadius: 6, border: '1px solid var(--bunker-sand-deep)', background: hcpEdits[p.id] ? 'var(--tour-navy)' : 'var(--bunker-sand)', color: hcpEdits[p.id] ? '#F5EFE0' : 'var(--ink)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      {/* OCR Aliases */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Aliases</span>
                        {(p.nicknames ?? []).map(alias => (
                          <span key={alias} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 5px 2px 7px', borderRadius: 5, background: 'var(--tour-navy)', color: '#F5EFE0', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600 }}>
                            {alias}
                            <button onClick={() => removeAlias(p.id, alias)} disabled={savingNicknames === p.id} aria-label={`Remove alias ${alias}`} style={{ width: 13, height: 13, borderRadius: '50%', border: 0, background: 'rgba(255,255,255,.22)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
                              <X size={7} strokeWidth={3} />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={nicknameEdits[p.id] ?? ''}
                          onChange={e => setNicknameEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') addAlias(p.id, nicknameEdits[p.id] ?? '') }}
                          onBlur={() => { if (nicknameEdits[p.id]?.trim()) addAlias(p.id, nicknameEdits[p.id] ?? '') }}
                          placeholder="+ add"
                          disabled={savingNicknames === p.id}
                          style={{ height: 22, padding: '0 6px', borderRadius: 5, border: '1px dashed var(--bunker-sand-deep)', background: 'transparent', color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)', fontSize: 10, outline: 'none', width: 56 }}
                        />
                      </div>

                    </div>

                    {/* Right: delete + admin toggle */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                      <button
                        onClick={() => deletePlayer(p)}
                        style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: '1px solid var(--bunker-sand-deep)', color: 'var(--ink-faint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        aria-label={`Remove ${p.name}`}
                      >
                        <X size={13} strokeWidth={2} />
                      </button>
                      {hasAccount && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: member!.is_admin ? 'var(--fairway-green)' : 'var(--ink-faint)' }}>
                            {isSuperAdmin ? 'Super admin' : member!.is_admin ? 'Admin' : 'Member'}
                          </span>
                          <Toggle
                            on={member!.is_admin}
                            disabled={isSuperAdmin || toggling === member!.email}
                            onChange={() => toggleAdmin(member!.email, member!.is_admin)}
                          />
                        </div>
                      )}
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
