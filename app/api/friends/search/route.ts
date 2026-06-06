import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ results: [] })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const isEmail = q.includes('@')

  let query = admin
    .from('user_profiles')
    .select('id, full_name, username, avatar_url')
    .neq('id', user.id)
    .limit(8)

  if (isEmail) {
    query = query.ilike('email', q)
  } else {
    const handle = q.startsWith('@') ? q.slice(1) : q
    query = query.ilike('username', `${handle}%`)
  }

  const { data } = await query
  return NextResponse.json({ results: data ?? [] })
}
