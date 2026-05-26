export function PlayerAvatar({
  name,
  avatarUrl,
  size = 28,
  gold = false,
}: {
  name: string
  avatarUrl?: string | null
  size?: number
  gold?: boolean
}) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: size, height: size, borderRadius: '50%', flexShrink: 0,
          objectFit: 'cover', objectPosition: 'top center',
          background: 'var(--trophy-gold)',
          outline: '2px solid var(--trophy-gold)',
          outlineOffset: 1,
        }}
      />
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--trophy-gold)',
      color: 'var(--tour-navy)',
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: size * 0.42, letterSpacing: '.04em',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {initials}
    </div>
  )
}
