import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCalendarToken } from '@/lib/calendarToken'

// Returns the calendar subscription URL for the authenticated user
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = generateCalendarToken(user.id)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://getdrivn.app'
    const url = `${baseUrl}/api/calendar/${token}`

    return NextResponse.json({ url })
  } catch (err) {
    console.error('[calendar token]', err)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}
