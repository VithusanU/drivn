'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Calendar, ChevronRight } from 'lucide-react'
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(eventDate)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `In ${diff} days`
}

function formatEventTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${period}`
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
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
    <button
      onClick={() => onEdit(event)}
      className={cn(
        'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left',
        'bg-card/50 border border-border/50 hover:bg-card hover:border-border active:scale-[0.99]'
      )}
    >
      <span className="text-lg flex-shrink-0">{CATEGORY_EMOJI[event.category]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{event.title}</p>
        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
          {formatEventDate(event.event_date)}
          {event.event_time && ` · ${formatEventTime(event.event_time)}`}
        </p>
      </div>
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
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
    </button>
  )
}

export default function UpcomingEvents() {
  const getUpcomingEvents = useEventStore((s) => s.getUpcomingEvents)
  useEventStore((s) => s.events) // reactive subscription
  const [addOpen, setAddOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  const upcoming = getUpcomingEvents(7)

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
            Upcoming this week
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
            No events this week — add one
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
