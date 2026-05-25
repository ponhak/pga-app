import { createEvent } from 'ics'

export function generateICS(round: {
  id: string
  date: string
  tee_time: string | null
  notes: string | null
}): string {
  const [year, month, day] = round.date.split('-').map(Number)
  const [hour, minute] = (round.tee_time ?? '08:00').split(':').map(Number)

  const { value, error } = createEvent({
    uid: `pga-schager-round-${round.id}`,
    title: 'PGA Schager — Golf Round',
    location: round.notes?.trim() || 'TBD',
    start: [year, month, day, hour, minute],
    duration: { hours: 4 },
    status: 'CONFIRMED',
    busyStatus: 'BUSY',
    organizer: { name: 'PGA Schager', email: 'onboarding@resend.dev' },
  })

  if (error || !value) throw new Error(`Failed to generate ICS: ${error}`)
  return value
}
