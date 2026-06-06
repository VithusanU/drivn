'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Calendar, ChevronRight, CalendarPlus } from 'lucide-react'
import { useEventStore } from '@/stores/eventStore'
import AddEventSheet from '@/components/events/AddEventSheet'
import { cn } from '@/lib/utils'
import type { CalendarEvent, EventCategory } from '@/types'

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  appointment: '🏥',
  maintenance: '🔧',
  personal: '🙂',
  health: '💊',
  other: '📌',
}

function getCountdown(eventDate: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`

  if (eventDate === todayStr) return 'Today'
  if (eventDate === tomorrowStr) return 'Tomorrow'

  const [y, m, d] = eventDate.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((target.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 7) return `In ${diff} days`
  if (diff < 14) return 'Next week'
  const weeks = Math.round(diff / 7)
  return `In ${weeks} weeks`
}

function formatEventTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${period}`
}

function formatEventDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Download a single event as an .ics file
function downloadICS(event: CalendarEvent) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`

  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

  const [ey, em, ed] = event.event_date.split('-')
  const hasTime = !!event.event_time
  const dtstart = hasTime
    ? `DTSTART:${ey}${em}${ed}T${event.event_time!.replace(':', '')}00`
    : `DTSTART;VALUE=DATE:${ey}${em}${ed}`

  const nextD = new Date(Number(ey), Number(em) - 1, Number(ed) + 1)
  const dtend = hasTime
    ? `DTEND:${ey}${em}${ed}T${event.event_time!.replace(':', '')}00`
    : `DTEND;VALUE=DATE:${nextD.getFullYear()}${pad(nextD.getMonth() + 1)}${pad(nextD.getDate())}`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Drivn//Drivn Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@getdrivn.app`,
    `DTSTAMP:${stamp}`,
    dtstart,
    dtend,
    `SUMMARY:${esc(event.title)}`,
    event.notes ? `DESCRIPTION:${esc(event.notes)}` : '',
    `CATEGORIES:${event.category.toUpperCase()}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([lines], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title.toLowerCase().replace(/\s+/g, '-')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

interface EventRowProps {
  event: CalendarEvent
  onEdit: (event: CalendarEvent) => void
}

function EventRow({ event, onEdit }: EventRowProps) {
  const countdown = getCountdown(event.event_date)
  const isToday = countdown === 'Today'
  const isTomorrow = countdown === 'Tomorrow'

  return (
    <div className={cn(
      'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl',
      'bg-card/50 border border-border/50'
    )}>
      <button
        onClick={() => onEdit(event)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <span className="text-lg flex-shrink-0">{CATEGORY_EMOJI[event.category]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground truncate">{event.title}</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            {formatEventDate(event.event_date)}
            {event.event_time && ` · ${formatEventTime(event.event_time)}`}
          </p>
        </div>
      </button>

      <span className={cn(
        'text-[11px] font-medium px-2.5 py-1 rounded-full border flex-shrink-0',
        isToday
          ? 'bg-destructive/10 border-destructive/25 text-destructive'
          : isTomorrow
            ? 'bg-amber-400/10 border-amber-400/25 text-amber-400'
            : 'bg-primary/8 border-primary/20 text-primary/70'
      )}>
        {countdown}
      </span>

      {/* Add to device calendar */}
      <button
        onClick={(e) => { e.stopPropagation(); downloadICS(event) }}
        aria-label="Add to calendar"
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-primary/60 transition-colors"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function UpcomingEvents() {
  const getUpcomingEvents = useEventStore((s) => s.getUpcomingEvents)
  useEventStore((s) => s.events) // reactive subscription
  const [addOpen, setAddOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  const upcoming = getUpcomingEvents(30)

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
            Upcoming
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-primary/70 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {upcoming.length === 0 ? (
          <button
            onClick={() => setAddOpen(true)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-dashed',
              'border-border/40 text-muted-foreground/40 hover:border-primary/30 hover:text-primary/50',
              'transition-colors text-[13px]'
            )}
          >
            <Calendar className="w-4 h-4" />
            No upcoming events — add one
          </button>
        ) : (
          <AnimatePresence>
            <div className="space-y-1.5">
              {upcoming.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                >
                  <EventRow event={event} onEdit={(e) => { setEditingEvent(e); setAddOpen(true) }} />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      <AddEventSheet
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditingEvent(null) }}
        editingEvent={editingEvent}
      />
    </>
  )
}
