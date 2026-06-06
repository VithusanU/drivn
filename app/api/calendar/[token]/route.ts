import { NextRequest, NextResponse } from 'next/server'
import { verifyCalendarToken } from '@/lib/calendarToken'
import { createAdminClient } from '@/lib/supabase/admin'

function pad(n: number) { return String(n).padStart(2, '0') }

// Convert a yyyy-MM-dd date + optional HH:mm time to ICS format
function toICSDateTime(dateStr: string, timeStr?: string | null): string {
  const [y, m, d] = dateStr.split('-')
  if (timeStr) {
    const [h, min] = timeStr.split(':')
    return `${y}${m}${d}T${h}${min}00`
  }
  return `${y}${m}${d}`
}

// Add one day to a yyyy-MM-dd string for all-day DTEND
function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + 1)
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

// Escape special ICS characters
function icsEscape(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function generateICS(events: any[], calName: string): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Drivn//Drivn Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calName)}`,
    'X-WR-TIMEZONE:UTC',
  ]

  for (const event of events) {
    const hasTime = !!event.event_time
    const dtstart = hasTime
      ? `DTSTART:${toICSDateTime(event.event_date, event.event_time)}`
      : `DTSTART;VALUE=DATE:${toICSDateTime(event.event_date)}`
    const dtend = hasTime
      ? `DTEND:${toICSDateTime(event.event_date, event.event_time)}`
      : `DTEND;VALUE=DATE:${nextDay(event.event_date)}`

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.id}@getdrivn.app`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(dtstart)
    lines.push(dtend)
    lines.push(`SUMMARY:${icsEscape(event.title)}`)
    if (event.notes) lines.push(`DESCRIPTION:${icsEscape(event.notes)}`)
    lines.push(`CATEGORIES:${event.category.toUpperCase()}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const userId = verifyCalendarToken(params.token)
  if (!userId) {
    return new NextResponse('Invalid or expired calendar token.', { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Fetch user name for calendar title
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()

    // Fetch all future + recent events for the user
    const past = new Date()
    past.setDate(past.getDate() - 30)
    const pastStr = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('event_date', pastStr)
      .order('event_date', { ascending: true })

    if (error) throw error

    const calName = profile?.full_name ? `${profile.full_name}'s Drivn Events` : 'Drivn Events'
    const ics = generateICS(events ?? [], calName)

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="drivn-events.ics"',
        // No-cache so calendar apps always get fresh data
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (err) {
    console.error('[calendar feed]', err)
    return new NextResponse('Failed to generate calendar.', { status: 500 })
  }
}
