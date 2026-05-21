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

// Rising triad chime using Web Audio API — no audio file needed
function playCompletionSound() {
  try {
    const ctx = new AudioContext()
    const notes = [523, 659, 784] // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * 0.2
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.4, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7)
      osc.start(start)
      osc.stop(start + 0.7)
    })
  } catch {
    // AudioContext blocked or unavailable — silent fallback
  }
}

// Show a local notification via the service worker (works even when tab is in background)
async function showTimerNotification(taskTitle?: string) {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    reg.showNotification('Time is up! ⏰', {
      body: taskTitle
        ? `Your focus session on "${taskTitle}" is complete.`
        : 'Your focus session is complete.',
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url: window.location.href },
    })
  } catch {
    // Service worker not ready — fall back to basic Notification
    try {
      new Notification('Time is up! ⏰', {
        body: taskTitle
          ? `Your focus session on "${taskTitle}" is complete.`
          : 'Your focus session is complete.',
        icon: '/logo.png',
      })
    } catch { /* denied or unsupported */ }
  }
}

interface FocusTimerProps {
  initialMinutes: number
  onComplete: () => void
  taskTitle?: string
}

export default function FocusTimer({ initialMinutes, onComplete, taskTitle }: FocusTimerProps) {
  const totalSeconds = initialMinutes * 60

  // Deadline-based approach: store the absolute timestamp when the timer should end.
  // This survives tab switching, browser throttling, and backgrounding — when the tab
  // comes back we just subtract Date.now() to get the true remaining time.
  const endTimeRef = useRef<number>(Date.now() + totalSeconds * 1000)
  // When paused: how many ms were remaining at the moment of pause
  const pausedRemainingRef = useRef<number | null>(null)
  const firedRef = useRef(false)

  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const [totalSet, setTotalSet] = useState(totalSeconds)
  const [running, setRunning] = useState(true)
  const [timeUp, setTimeUp] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Request notification permission when the timer mounts
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const fireCompletion = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    clearInterval(intervalRef.current!)
    setRunning(false)
    setSecondsLeft(0)
    setTimeUp(true)
    playCompletionSound()
    showTimerNotification(taskTitle)
  }, [taskTitle])

  // Each tick: compute remaining from the absolute endTime so drift is impossible
  const tick = useCallback(() => {
    const remaining = Math.round((endTimeRef.current - Date.now()) / 1000)
    if (remaining <= 0) {
      fireCompletion()
    } else {
      setSecondsLeft(remaining)
    }
  }, [fireCompletion])

  useEffect(() => {
    if (running) {
      tick() // sync immediately on start/resume
      intervalRef.current = setInterval(tick, 1000)
    } else {
      clearInterval(intervalRef.current!)
    }
    return () => clearInterval(intervalRef.current!)
  }, [running, tick])

  // When tab becomes visible again, sync the display immediately.
  // We deliberately do NOT pause — endTime keeps counting while hidden.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && running && !timeUp) {
        const remaining = Math.round((endTimeRef.current - Date.now()) / 1000)
        if (remaining <= 0) {
          fireCompletion()
        } else {
          setSecondsLeft(remaining)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [running, timeUp, fireCompletion])

  const togglePause = () => {
    if (running) {
      // Save how many ms remain so we can restore exactly when resumed
      pausedRemainingRef.current = endTimeRef.current - Date.now()
      setRunning(false)
    } else {
      // Shift endTime forward by whatever was left when paused
      endTimeRef.current = Date.now() + (pausedRemainingRef.current ?? secondsLeft * 1000)
      pausedRemainingRef.current = null
      setRunning(true)
    }
  }

  const addTime = (minutes: number) => {
    const extraMs = minutes * 60 * 1000
    endTimeRef.current += extraMs
    setTotalSet((prev) => prev + minutes * 60)
    if (!running && pausedRemainingRef.current !== null) {
      pausedRemainingRef.current += extraMs
      setSecondsLeft((prev) => prev + minutes * 60)
    }
    firedRef.current = false
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
          onClick={togglePause}
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
