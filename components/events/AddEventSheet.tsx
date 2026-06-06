'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Calendar, Clock, Repeat } from 'lucide-react'
import { useEventStore } from '@/stores/eventStore'
import { useUndoStore } from '@/stores/undoStore'
import { cn } from '@/lib/utils'
import type { CalendarEvent, EventCategory, EventRecurrence, CreateEventInput, UpdateEventInput } from '@/types'

const CATEGORIES: { value: EventCategory; label: string; emoji: string }[] = [
  { value: 'appointment', label: 'Appointment', emoji: '🏥' },
  { value: 'maintenance', label: 'Maintenance', emoji: '🔧' },
  { value: 'personal', label: 'Personal', emoji: '🙂' },
  { value: 'health', label: 'Health', emoji: '💊' },
  { value: 'other', label: 'Other', emoji: '📌' },
]

const RECURRENCES: { value: EventRecurrence; label: string }[] = [
  { value: 'none', label: 'No repeat' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
]

interface Props {
  open: boolean
  onClose: () => void
  editingEvent?: CalendarEvent | null
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AddEventSheet({ open, onClose, editingEvent }: Props) {
  const createEvent = useEventStore((s) => s.createEvent)
  const updateEvent = useEventStore((s) => s.updateEvent)
  const deleteEvent = useEventStore((s) => s.deleteEvent)
  const undoDeleteEvent = useEventStore((s) => s.undoDeleteEvent)
  const showUndo = useUndoStore((s) => s.show)

  const [title, setTitle] = useState(editingEvent?.title ?? '')
  const [date, setDate] = useState(editingEvent?.event_date ?? localDateStr(new Date()))
  const [time, setTime] = useState(editingEvent?.event_time ?? '')
  const [category, setCategory] = useState<EventCategory>(editingEvent?.category ?? 'personal')
  const [recurrence, setRecurrence] = useState<EventRecurrence>(editingEvent?.recurrence ?? 'none')
  const [recurrenceDays, setRecurrenceDays] = useState(editingEvent?.recurrence_days ?? 14)
  const [notes, setNotes] = useState(editingEvent?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const todayStr = localDateStr(new Date())

  const handleSave = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    setSaveError(false)

    const payload: CreateEventInput = {
      title: title.trim(),
      event_date: date,
      event_time: time || null,
      category,
      recurrence,
      recurrence_days: recurrence === 'custom' ? recurrenceDays : null,
      notes: notes.trim() || null,
    }

    if (editingEvent) {
      await updateEvent(editingEvent.id, payload as UpdateEventInput)
      setSaving(false)
      onClose()
    } else {
      const result = await createEvent(payload)
      setSaving(false)
      if (result) {
        onClose()
      } else {
        setSaveError(true)
      }
    }
  }

  const handleDelete = async () => {
    if (!editingEvent) return
    const snap = { ...editingEvent }
    await deleteEvent(editingEvent.id)
    showUndo(`"${snap.title}" deleted`, () => undoDeleteEvent(snap.id, snap))
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'max-h-[90vh] flex flex-col',
              'bg-card rounded-t-3xl border-t border-border',
              'shadow-[0_-8px_40px_rgba(0,0,0,0.3)]'
            )}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-border/50">
              <h2 className="text-[15px] font-medium text-foreground">
                {editingEvent ? 'Edit event' : 'New event'}
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">Event name</p>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="e.g. Haircut, Oil change, Dentist"
                  className={cn(
                    'w-full px-3.5 py-3 rounded-xl border text-[14px]',
                    'bg-background text-foreground placeholder:text-muted-foreground/40',
                    'outline-none transition-colors',
                    title ? 'border-primary/40' : 'border-border'
                  )}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">Category</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all',
                        category === cat.value
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-border/50 text-muted-foreground/60 hover:border-primary/30 hover:text-primary/70'
                      )}
                    >
                      <span>{cat.emoji}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">
                    <Calendar className="w-3 h-3 inline mr-1" />Date
                  </p>
                  <input
                    type="date"
                    value={date}
                    min={todayStr}
                    onChange={(e) => setDate(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-xl border text-[12px]',
                      'bg-background text-foreground outline-none transition-all',
                      date ? 'border-primary/40 text-primary' : 'border-border/50',
                      '[color-scheme:dark]'
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">
                    <Clock className="w-3 h-3 inline mr-1" />Time (optional)
                  </p>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-xl border text-[12px]',
                      'bg-background text-foreground outline-none transition-all',
                      time ? 'border-primary/40 text-primary' : 'border-border/50',
                      '[color-scheme:dark]'
                    )}
                  />
                </div>
              </div>

              {/* Recurrence */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">
                  <Repeat className="w-3 h-3 inline mr-1" />Repeat
                </p>
                <div className="flex gap-2 flex-wrap">
                  {RECURRENCES.map((rec) => (
                    <button
                      key={rec.value}
                      onClick={() => setRecurrence(rec.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all',
                        recurrence === rec.value
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-border/50 text-muted-foreground/60 hover:border-primary/30'
                      )}
                    >
                      {rec.label}
                    </button>
                  ))}
                </div>
                {recurrence === 'custom' && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[12px] text-muted-foreground/60">Every</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={recurrenceDays}
                      onChange={(e) => setRecurrenceDays(Number(e.target.value))}
                      className="w-16 px-2.5 py-1.5 rounded-xl border border-border text-[13px] bg-background text-foreground outline-none text-center"
                    />
                    <span className="text-[12px] text-muted-foreground/60">days</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">Notes (optional)</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any details…"
                  rows={2}
                  className={cn(
                    'w-full px-3.5 py-2.5 rounded-xl border text-[13px] resize-none',
                    'bg-background text-foreground placeholder:text-muted-foreground/30',
                    'outline-none transition-colors',
                    notes ? 'border-primary/30' : 'border-border/50'
                  )}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 flex-shrink-0 border-t border-border/50 space-y-2">
              {saveError && (
                <p className="text-[12px] text-destructive/70 text-center">
                  Failed to save — make sure the database migration has been run.
                </p>
              )}
              <button
                onClick={handleSave}
                disabled={!title.trim() || saving}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl',
                  'bg-primary text-primary-foreground text-[15px] font-medium',
                  'transition-all active:scale-[0.98] hover:bg-primary/90',
                  'disabled:opacity-50'
                )}
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving…' : editingEvent ? 'Save changes' : 'Add event'}
              </button>
              {editingEvent && (
                <button
                  onClick={handleDelete}
                  className="w-full py-2.5 rounded-2xl text-[13px] text-destructive/60 hover:text-destructive transition-colors"
                >
                  Delete event
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
