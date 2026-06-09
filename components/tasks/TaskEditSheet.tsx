'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Link2, Flame } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { cn } from '@/lib/utils'
import type { Task, TaskUrgency } from '@/types'

const URGENCY_OPTIONS: { value: TaskUrgency; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const URGENCY_STYLES: Record<TaskUrgency, { active: string; inactive: string }> = {
  high: {
    active: 'bg-destructive/15 border-destructive/40 text-destructive',
    inactive: 'border-border/50 text-muted-foreground/50 hover:border-destructive/30 hover:text-destructive/60',
  },
  medium: {
    active: 'bg-amber-400/10 border-amber-400/40 text-amber-400',
    inactive: 'border-border/50 text-muted-foreground/50 hover:border-amber-400/30 hover:text-amber-400/60',
  },
  low: {
    active: 'bg-muted border-border text-muted-foreground',
    inactive: 'border-border/50 text-muted-foreground/30 hover:border-border hover:text-muted-foreground/50',
  },
}

const TIME_MIN = 10
const TIME_MAX = 480

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DATE_PRESETS = [
  {
    label: 'Today',
    value: () => localDateStr(new Date()),
  },
  {
    label: 'Tomorrow',
    value: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return localDateStr(d)
    },
  },
  {
    label: 'This week',
    value: () => {
      const d = new Date()
      const diff = 7 - (d.getDay() === 0 ? 7 : d.getDay())
      d.setDate(d.getDate() + diff)
      return localDateStr(d)
    },
  },
]

interface TaskEditSheetProps {
  task: Task
  open: boolean
  onClose: () => void
}

export default function TaskEditSheet({ task, open, onClose }: TaskEditSheetProps) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const tasks = useTaskStore((s) => s.tasks)

  const [title, setTitle] = useState(task.title)
  const [urgency, setUrgency] = useState<TaskUrgency>(task.urgency)
  const [dueDate, setDueDate] = useState<string>(task.due_date ?? '')
  const [dueTime, setDueTime] = useState<string>(task.due_time ?? '')
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(task.estimated_minutes ?? null)
  const [blockedBy, setBlockedBy] = useState<string | null>(task.blocked_by ?? null)
  const [isHardDeadline, setIsHardDeadline] = useState<boolean>(task.is_hard_deadline ?? false)
  const [saving, setSaving] = useState(false)

  // Re-sync state from the latest task data every time the sheet opens
  useEffect(() => {
    if (open) {
      setTitle(task.title)
      setUrgency(task.urgency)
      setDueDate(task.due_date ?? '')
      setDueTime(task.due_time ?? '')
      setEstimatedMinutes(task.estimated_minutes ?? null)
      setBlockedBy(task.blocked_by ?? null)
      setIsHardDeadline(task.is_hard_deadline ?? false)
    }
  }, [open])

  // Use local date (not UTC) so min attribute is correct in all timezones
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const handleSave = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    await updateTask(task.id, {
      title: title.trim(),
      urgency,
      due_date: dueDate || null,
      due_time: dueTime || null,
      estimated_minutes: estimatedMinutes,
      blocked_by: blockedBy,
      is_hard_deadline: dueDate ? isHardDeadline : false,
    })
    setSaving(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card border-t border-border p-5 space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-muted-foreground/60">
                Edit task
              </p>
              <button onClick={onClose} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                'w-full bg-background border border-border rounded-xl px-3 py-2.5',
                'text-[14px] text-foreground/80 outline-none',
                'focus:border-primary/40 transition-colors'
              )}
            />

            {/* Urgency */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">Priority</p>
              <div className="flex gap-2">
                {URGENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setUrgency(opt.value)}
                    className={cn(
                      'flex-1 py-2 rounded-xl border text-[12px] font-medium transition-all',
                      urgency === opt.value ? URGENCY_STYLES[opt.value].active : URGENCY_STYLES[opt.value].inactive
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">Due date</p>
              <div className="flex gap-2">
                {DATE_PRESETS.map((preset) => {
                  const presetVal = preset.value()
                  const isActive = dueDate === presetVal
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setDueDate(isActive ? '' : presetVal)}
                      className={cn(
                        'flex-1 py-2 rounded-xl border text-[12px] font-medium transition-all',
                        isActive
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-border/50 text-muted-foreground/50 hover:border-primary/30 hover:text-primary/60'
                      )}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
              <input
                type="date"
                value={dueDate}
                min={todayStr}
                onChange={(e) => setDueDate(e.target.value)}
                className={cn(
                  'w-full px-3 py-2.5 rounded-xl border text-[12px] transition-all',
                  'bg-background text-foreground/70 outline-none',
                  dueDate ? 'border-primary/40 text-primary' : 'border-border/50 text-muted-foreground/40',
                  '[color-scheme:dark]'
                )}
              />
            </div>

            {/* Hard deadline toggle — only shown when a date is set */}
            {dueDate && (
              <button
                onClick={() => setIsHardDeadline((v) => !v)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-[12px] transition-all',
                  isHardDeadline
                    ? 'bg-red-500/8 border-red-500/25 text-red-400'
                    : 'border-border/50 text-muted-foreground/50 hover:border-red-500/20 hover:text-red-400/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Hard deadline</span>
                  <span className={cn(
                    'text-[10px]',
                    isHardDeadline ? 'text-red-400/60' : 'text-muted-foreground/30'
                  )}>must be done by this date</span>
                </div>
                <div className={cn(
                  'relative w-8 h-4 rounded-full transition-colors flex-shrink-0',
                  isHardDeadline ? 'bg-red-500' : 'bg-border'
                )}>
                  <div className={cn(
                    'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform',
                    isHardDeadline ? 'translate-x-[17px]' : 'translate-x-[1px]'
                  )} />
                </div>
              </button>
            )}

            {/* Due time — only shown when a date is set */}
            {dueDate && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">
                    Due time <span className="normal-case font-normal">(optional)</span>
                  </p>
                  {dueTime && (
                    <button
                      onClick={() => setDueTime('')}
                      className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-xl border text-[12px] transition-all',
                    'bg-background text-foreground/70 outline-none',
                    dueTime ? 'border-primary/40 text-primary' : 'border-border/50 text-muted-foreground/40',
                    '[color-scheme:dark]'
                  )}
                />
              </div>
            )}

            {/* Time estimate */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">Time estimate</p>
                {estimatedMinutes !== null ? (
                  <span className="text-[12px] font-medium text-primary">{formatTime(estimatedMinutes)}</span>
                ) : (
                  <span className="text-[12px] text-muted-foreground/30">not set</span>
                )}
              </div>
              <input
                type="range"
                min={TIME_MIN}
                max={TIME_MAX}
                step={5}
                value={estimatedMinutes ?? TIME_MIN}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                onMouseDown={() => { if (estimatedMinutes === null) setEstimatedMinutes(TIME_MIN) }}
                onTouchStart={() => { if (estimatedMinutes === null) setEstimatedMinutes(TIME_MIN) }}
                className="w-full h-1.5 appearance-none rounded-full cursor-pointer bg-border
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                  [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_hsl(var(--primary)/0.2)]
                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                  [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0
                  [&::-moz-range-thumb]:bg-primary"
                style={{
                  background: estimatedMinutes !== null
                    ? `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((estimatedMinutes - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100}%, hsl(var(--border)) ${((estimatedMinutes - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100}%, hsl(var(--border)) 100%)`
                    : undefined,
                }}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/30">
                <span>10m</span><span>2h</span><span>4h</span><span>8h</span>
              </div>
              {estimatedMinutes !== null && (
                <button
                  onClick={() => setEstimatedMinutes(null)}
                  className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Depends on */}
            {tasks.filter((t) => t.status === 'active' && t.id !== task.id).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">
                  Depends on <span className="normal-case font-normal">(optional)</span>
                </p>
                {blockedBy ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5">
                    <Link2 className="w-3 h-3 text-primary/60 flex-shrink-0" />
                    <span className="text-[12px] text-primary/80 flex-1 truncate">
                      {tasks.find((t) => t.id === blockedBy)?.title ?? 'Unknown task'}
                    </span>
                    <button
                      onClick={() => setBlockedBy(null)}
                      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {tasks
                      .filter((t) => t.status === 'active' && t.id !== task.id)
                      .slice(0, 10)
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setBlockedBy(t.id)}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left',
                            'border-border/50 text-muted-foreground/60 text-[12px]',
                            'hover:border-primary/30 hover:text-primary/70 transition-colors'
                          )}
                        >
                          <span className="truncate">{t.title}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl',
                'bg-primary text-primary-foreground text-[15px] font-medium',
                'transition-all active:scale-[0.98] hover:bg-primary/90',
                'disabled:opacity-50'
              )}
            >
              <Check className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
