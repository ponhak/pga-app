import { createClient } from '@supabase/supabase-js'

// Strip BOM (U+FEFF) that can be prepended when env vars are set via CLI on Windows
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^﻿/, '')
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').replace(/^﻿/, '')

export const supabase = createClient(url, key)
