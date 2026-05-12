import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('email')
    .eq('email', (email as string).toLowerCase().trim())
    .limit(1)

  if (error) return NextResponse.json({ allowed: false, error: error.message }, { status: 500 })
  return NextResponse.json({ allowed: Array.isArray(data) && data.length > 0 })
}
