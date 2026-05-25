import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase-server'
import { generateICS } from '@/lib/calendar'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { roundId } = await req.json()
  if (!roundId) return NextResponse.json({ error: 'Missing roundId' }, { status: 400 })

  // Fetch round details
  const { data: round, error: roundErr } = await supabaseAdmin
    .from('rounds')
    .select('id, date, tee_time, notes')
    .eq('id', roundId)
    .single()

  if (roundErr || !round) {
    return NextResponse.json({ error: 'Round not found' }, { status: 404 })
  }

  // Fetch all allowed emails
  const { data: emails, error: emailErr } = await supabaseAdmin
    .from('allowed_emails')
    .select('email')

  if (emailErr || !emails?.length) {
    return NextResponse.json({ error: 'No recipients found' }, { status: 500 })
  }

  // Generate .ics
  let icsContent: string
  try {
    icsContent = generateICS(round)
  } catch {
    return NextResponse.json({ error: 'Failed to generate calendar file' }, { status: 500 })
  }

  const d = new Date(round.date + 'T12:00:00')
  const dateLabel = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const teeLabel = round.tee_time
    ? new Date(`1970-01-01T${round.tee_time}:00`).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '08:00'
  const venue = round.notes?.trim() || 'TBD'

  // Send one email per recipient
  const results = await Promise.allSettled(
    emails.map(({ email }) =>
      resend.emails.send({
        from: 'PGA Schager <onboarding@resend.dev>',
        to: email,
        subject: `New round scheduled — ${dateLabel}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#0A2240;margin-bottom:4px">PGA Schager</h2>
            <h3 style="color:#C9A24A;margin-top:0">New Round Scheduled</h3>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#666;font-size:13px">Date</td><td style="padding:6px 0;font-weight:600;font-size:13px">${dateLabel}</td></tr>
              <tr><td style="padding:6px 0;color:#666;font-size:13px">First tee</td><td style="padding:6px 0;font-weight:600;font-size:13px">${teeLabel}</td></tr>
              <tr><td style="padding:6px 0;color:#666;font-size:13px">Venue</td><td style="padding:6px 0;font-weight:600;font-size:13px">${venue}</td></tr>
            </table>
            <p style="font-size:12px;color:#999;margin-top:24px">The .ics file attached will add this round to your calendar.</p>
          </div>
        `,
        attachments: [
          {
            filename: `pga-round-${round.date}.ics`,
            content: Buffer.from(icsContent).toString('base64'),
          },
        ],
      })
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ sent, total: emails.length })
}
