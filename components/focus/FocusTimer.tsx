'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pause, Play, Plus, Coffee, Minus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimerStore } from '@/stores/timerStore'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const EXTRA_TIME_OPTIONS = [
  { label: '+5m', value: 5 },
  { label: '+10m', value: 10 },
  { label: '+15m', value: 15 },
  { label: '+30m', value: 30 },
]

interface FocusTimerProps {
  taskId: string
  initialMinutes: number
  onComplete: () => void
  taskTitle?: string
}

export default function FocusTimer({ taskId, initialMinutes, onComplete, taskTitle }: FocusTimerProps) {
  const initTimer = useTimerStore((s) => s.initTimer)
  const pause = useTimerStore((s) => s.pause)
  const resume = useTimerStore((s) => s.resume)
  const addTime = useTimerStore((s) => s.addTime)
  const startBreak = useTimerStore((s) => s.startBreak)
  const endBreak = useTimerStore((s) => s.endBreak)

  const storeTaskId = useTimerStore((s) => s.taskId)
  const secondsLeft = useTimerStore((s) => s.secondsLeft)
  const totalSeconds = useTimerStore((s) => s.totalSeconds)
  const running = useTimerStore((s) => s.running)
  const timeUp = useTimerStore((s) => s.timeUp)
  const breakActive = useTimerStore((s) => s.breakActive)
  const breakSecondsLeft = useTimerStore((s) => s.breakSecondsLeft)
  const breakTotalSeconds = useTimerStore((s) => s.breakTotalSeconds)

  const [breakPickerOpen, setBreakPickerOpen] = useState(false)
  const [breakMinutes, setBreakMinutes] = useState(10)

  // Init only if this task isn't already the active one — preserves timer when navigating back
  useEffect(() => {
    if (useTimerStore.getState().taskId !== taskId) {
      initTimer(taskId, taskTitle ?? '', initialMinutes)
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartBreak = () => {
    startBreak(breakMinutes)
    setBreakPickerOpen(false)
    setBreakMinutes(10)
  }

  // Ring
  const progress = breakActive
    ? (breakTotalSeconds > 0 ? breakSecondsLeft / breakTotalSeconds : 0)
    : (totalSeconds > 0 ? secondsLeft / totalSeconds : 0)
  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const ringColor = breakActive
    ? '#3b82f6'
    : progress > 0.5
      ? 'hsl(var(--drivn-green))'
      : progress > 0.2
        ? 'hsl(var(--primary))'
        : 'hsl(var(--destructive))'

  const centerTime = breakActive ? formatTime(breakSecondsLeft) : formatTime(secondsLeft)
  const centerLabel = breakActive
    ? 'break'
    : running ? 'remaining' : timeUp ? "time's up" : 'paused'

  // Show a loading ring if the store hasn't synced yet (briefly on first mount)
  if (storeTaskId !== taskId) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-[160px] h-[160px] rounded-full border-[5px] border-border flex items-center justify-center">
          <span className="text-muted-foreground/30 text-[13px]">...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      {/* Ring */}
      <div className="relative w-[160px] h-[160px] mb-4">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="5"
          />
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-medium tabular-nums text-foreground leading-none">
            {centerTime}
          </span>
          <span className="text-[11px] text-muted-foreground/50 mt-1">
            {centerLabel}
          </span>
        </div>
      </div>

      {/* Controls */}
      <AnimatePresence mode="wait">
        {breakActive ? (
          <motion.div
            key="break-active"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25">
              <Coffee className="w-3 h-3 text-blue-400" />
              <span className="text-[11px] text-blue-400 font-medium">Break in progress</span>
            </div>
            <button
              onClick={endBreak}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-medium transition-all',
                'bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              )}
            >
              <X className="w-3.5 h-3.5" />
              End break early
            </button>
          </motion.div>
        ) : breakPickerOpen ? (
          <motion.div
            key="break-picker"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="w-full max-w-xs rounded-2xl border border-border bg-card p-4"
          >
            <p className="text-[12px] font-medium text-muted-foreground text-center mb-3">
              How long is your break?
            </p>
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={() => setBreakMinutes((m) => Math.max(5, m - 1))}
                className={cn(
                  'w-9 h-9 rounded-xl border border-border flex items-center justify-center',
                  'text-muted-foreground hover:text-foreground hover:bg-secondary transition-all'
                )}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-[22px] font-medium tabular-nums text-foreground w-16 text-center">
                {breakMinutes}m
              </span>
              <button
                onClick={() => setBreakMinutes((m) => Math.min(30, m + 1))}
                className={cn(
                  'w-9 h-9 rounded-xl border border-border flex items-center justify-center',
                  'text-muted-foreground hover:text-foreground hover:bg-secondary transition-all'
                )}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setBreakPickerOpen(false); setBreakMinutes(10) }}
                className={cn(
                  'flex-1 py-2 rounded-xl border border-border text-[13px]',
                  'text-muted-foreground hover:text-foreground hover:bg-secondary transition-all'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleStartBreak}
                className={cn(
                  'flex-1 py-2 rounded-xl text-[13px] font-medium',
                  'bg-blue-500/15 border border-blue-500/30 text-blue-400',
                  'hover:bg-blue-500/25 transition-all'
                )}
              >
                Start break
              </button>
            </div>
          </motion.div>
        ) : !timeUp ? (
          <motion.div
            key="normal-controls"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col items-center gap-2"
          >
            <button
              onClick={() => running ? pause() : resume()}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-medium transition-all',
                'bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              )}
            >
              {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Pause timer' : 'Resume timer'}
            </button>
            <button
              onClick={() => setBreakPickerOpen(true)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[12px] transition-all',
                'text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/50'
              )}
            >
              <Coffee className="w-3 h-3" />
              Take a break
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Time's up overlay */}
      <AnimatePresence>
        {timeUp && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              'mt-4 w-full max-w-xs rounded-2xl border border-border p-5 text-center',
              'bg-card'
            )}
          >
            <p className="text-[15px] font-medium text-foreground mb-1">Time's up!</p>
            <p className="text-[12px] text-muted-foreground mb-4">Need more time?</p>

            <div className="grid grid-cols-4 gap-2 mb-3">
              {EXTRA_TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => addTime(opt.value)}
                  className={cn(
                    'py-2 rounded-xl border border-border text-[12px] font-medium',
                    'text-muted-foreground hover:text-primary hover:border-primary/40',
                    'transition-all flex items-center justify-center gap-0.5'
                  )}
                >
                  <Plus className="w-2.5 h-2.5" />
                  {opt.label.replace('+', '')}
                </button>
              ))}
            </div>

            <button
              onClick={onComplete}
              className={cn(
                'w-full py-2.5 rounded-xl text-[13px] font-medium',
                'bg-drivn-green text-white hover:opacity-90 transition-all active:scale-[0.98]'
              )}
            >
              Complete task
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
