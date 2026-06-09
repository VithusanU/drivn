import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — upsert the current user's focus presence
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isFocusing, focusStartedAt } = await req.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('user_presence')
    .upsert({
      user_id: user.id,
      is_focusing: isFocusing ?? false,
      focus_started_at: isFocusing ? (focusStartedAt ?? new Date().toISOString()) : null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
