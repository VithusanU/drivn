'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pause, Play, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  initialMinutes: number
  onComplete: () => void
}

export default function FocusTimer({ initialMinutes, onComplete }: FocusTimerProps) {
  const totalSeconds = initialMinutes * 60
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const [totalSet, setTotalSet] = useState(totalSeconds)
  const [running, setRunning] = useState(true)
  const [timeUp, setTimeUp] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tick = useCallback(() => {
    setSecondsLeft((prev) => {
      if (prev <= 1) {
        clearInterval(intervalRef.current!)
        setRunning(false)
        setTimeUp(true)
        return 0
      }
      return prev - 1
    })
  }, [])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000)
    } else {
      clearInterval(intervalRef.current!)
    }
    return () => clearInterval(intervalRef.current!)
  }, [running, tick])

  // Pause when tab is hidden
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setRunning(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const addTime = (minutes: number) => {
    const extra = minutes * 60
    setSecondsLeft((prev) => prev + extra)
    setTotalSet((prev) => prev + extra)
    setTimeUp(false)
    setRunning(true)
  }

  const progress = totalSet > 0 ? secondsLeft / totalSet : 0
  const dashOffset = CIRCUMFERENCE * (1 - progress)

  const urgencyColor =
    progress > 0.5 ? 'hsl(var(--drivn-green))' :
    progress > 0.2 ? 'hsl(var(--primary))' :
    'hsl(var(--destructive))'

  return (
    <div className="flex flex-col items-center">
      {/* Ring */}
      <div className="relative w-[160px] h-[160px] mb-4">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Track */}
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="5"
          />
          {/* Progress */}
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke={urgencyColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-medium tabular-nums text-foreground leading-none">
            {formatTime(secondsLeft)}
          </span>
          <span className="text-[11px] text-muted-foreground/50 mt-1">
            {running ? 'remaining' : timeUp ? "time's up" : 'paused'}
          </span>
        </div>
      </div>

      {/* Play / Pause */}
      {!timeUp && (
        <button
          onClick={() => setRunning((r) => !r)}
          className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-medium transition-all',
            'bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80'
          )}
        >
          {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {running ? 'Pause timer' : 'Resume timer'}
        </button>
      )}

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
