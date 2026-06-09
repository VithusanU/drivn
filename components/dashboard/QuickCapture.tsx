'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Plus, SlidersHorizontal, X, Mic, MicOff, Link2, Camera, Flame } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { cn } from '@/lib/utils'
import { parseVoiceInput, isSpeechRecognitionSupported } from '@/lib/voiceParser'
import TaskScanner, { type TaskScannerRef } from './TaskScanner'
import type { TaskUrgency } from '@/types'

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

const DATE_PRESETS = [
  {
    label: 'Today',
    value: () => {
      const d = new Date()
      return d.toISOString().split('T')[0]
    },
  },
  {
    label: 'Tomorrow',
    value: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return d.toISOString().split('T')[0]
    },
  },
  {
    label: 'This week',
    value: () => {
      const d = new Date()
      const day = d.getDay()
      const diff = 7 - (day === 0 ? 7 : day)
      d.setDate(d.getDate() + diff)
      return d.toISOString().split('T')[0]
    },
  },
]

type VoiceState = 'idle' | 'listening' | 'processing'

export default function QuickCapture() {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const [urgency, setUrgency] = useState<TaskUrgency>('medium')
  const [dueDate, setDueDate] = useState<string>('')
  const [dueTime, setDueTime] = useState<string>('')
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null)
  const [blockedBy, setBlockedBy] = useState<string | null>(null)
  const [isHardDeadline, setIsHardDeadline] = useState<boolean>(false)

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [interimText, setInterimText] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null)
  const scannerRef = useRef<TaskScannerRef | null>(null)
  const createTask = useTaskStore((s) => s.createTask)
  const tasks = useTaskStore((s) => s.tasks)

  useEffect(() => {
    setVoiceSupported(isSpeechRecognitionSupported())
  }, [])

  const resetOptions = () => {
    setUrgency('medium')
    setDueDate('')
    setDueTime('')
    setEstimatedMinutes(null)
    setBlockedBy(null)
    setIsHardDeadline(false)
  }

  const handleSubmit = async () => {
    const trimmed = value.trim()
    if (!trimmed || saving) return

    setSaving(true)
    await createTask({
      title: trimmed,
      urgency,
      due_date: dueDate || null,
      due_time: dueTime || null,
      estimated_minutes: estimatedMinutes,
      blocked_by: blockedBy,
      is_hard_deadline: dueDate ? isHardDeadline : false,
    })
    setValue('')
    resetOptions()
    setExpanded(false)
    setSaving(false)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 1500)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') {
      setValue('')
      resetOptions()
      setExpanded(false)
      inputRef.current?.blur()
    }
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setVoiceState('idle')
    setInterimText('')
  }

  const startListening = () => {
    if (!voiceSupported) return

    // If already listening, stop
    if (voiceState === 'listening') {
      stopListening()
      return
    }

    const SR = (window.SpeechRecognition ?? (window as any).webkitSpeechRecognition) as typeof window.SpeechRecognition
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setVoiceState('listening')
      setInterimText('')
    }

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      // Show interim transcript live in input placeholder area
      setInterimText(interim)
      if (final) {
        setVoiceState('processing')
        setInterimText('')
        const parsed = parseVoiceInput(final)
        setValue(parsed.title)
        setUrgency(parsed.urgency)
        if (parsed.dueDate) {
          setDueDate(parsed.dueDate)
          setExpanded(true)
        }
        if (parsed.dueTime) {
          setDueTime(parsed.dueTime)
          setExpanded(true)
        }
      }
    }

    recognition.onerror = () => {
      stopListening()
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setVoiceState((s) => s === 'listening' ? 'idle' : s)
      setInterimText('')
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  // Clean up on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.abort() }
  }, [])

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <>
    <TaskScanner scannerRef={scannerRef} />
    <div className={cn(
      'fixed z-20 pb-3',
      'bottom-[60px] left-0 right-0',
      'md:bottom-6 md:left-[220px]'
    )}>
      <div className="max-w-2xl mx-auto px-4">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className={cn(
              'mb-1 rounded-2xl px-4 py-4 space-y-4',
              'bg-card border border-border',
              'shadow-[0_-4px_24px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)]'
            )}>

              {/* Urgency */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">
                  Priority
                </p>
                <div className="flex gap-2">
                  {URGENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setUrgency(opt.value)}
                      className={cn(
                        'flex-1 py-2 rounded-xl border text-[12px] font-medium transition-all',
                        urgency === opt.value
                          ? URGENCY_STYLES[opt.value].active
                          : URGENCY_STYLES[opt.value].inactive
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due date */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">
                  Due date
                </p>
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
                    dueDate
                      ? 'border-primary/40 text-primary'
                      : 'border-border/50 text-muted-foreground/40',
                    '[color-scheme:dark]'
                  )}
                />
              </div>

              {/* Hard deadline toggle — only when a date is set */}
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
                      dueTime
                        ? 'border-primary/40 text-primary'
                        : 'border-border/50 text-muted-foreground/40',
                      '[color-scheme:dark]'
                    )}
                  />
                </div>
              )}

              {/* Time estimate */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">
                    Time estimate
                  </p>
                  {estimatedMinutes !== null ? (
                    <span className="text-[12px] font-medium text-primary">
                      {formatTime(estimatedMinutes)}
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted-foreground/30">not set</span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    type="range"
                    min={TIME_MIN}
                    max={TIME_MAX}
                    step={5}
                    value={estimatedMinutes ?? TIME_MIN}
                    onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                    onMouseDown={() => { if (estimatedMinutes === null) setEstimatedMinutes(TIME_MIN) }}
                    onTouchStart={() => { if (estimatedMinutes === null) setEstimatedMinutes(TIME_MIN) }}
                    className="w-full h-1.5 appearance-none rounded-full cursor-pointer
                      bg-border
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-primary
                      [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_hsl(var(--primary)/0.2)]
                      [&::-webkit-slider-thumb]:transition-shadow
                      [&::-webkit-slider-thumb]:hover:shadow-[0_0_0_5px_hsl(var(--primary)/0.2)]
                      [&::-moz-range-thumb]:w-4
                      [&::-moz-range-thumb]:h-4
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:bg-primary"
                    style={{
                      background: estimatedMinutes !== null
                        ? `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((estimatedMinutes - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100}%, hsl(var(--border)) ${((estimatedMinutes - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100}%, hsl(var(--border)) 100%)`
                        : undefined,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground/30">
                  <span>10m</span>
                  <span>2h</span>
                  <span>4h</span>
                  <span>8h</span>
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
              {tasks.filter((t) => t.status === 'active').length > 0 && (
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
                        .filter((t) => t.status === 'active')
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

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <motion.div
        layout
        className={cn(
          'flex items-center gap-2 px-4 py-1 rounded-2xl',
          'bg-card border border-border',
          'shadow-[0_-8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.4)]',
          'transition-all duration-150',
          value.length > 0 && 'border-primary/30',
          voiceState === 'listening' && 'border-red-500/40'
        )}
      >
        <Plus className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            voiceState === 'listening'
              ? (interimText || 'Listening…')
              : 'What needs to get done?'
          }
          className={cn(
            'flex-1 bg-transparent border-none outline-none py-3',
            'text-[14px] text-foreground/70 placeholder:text-muted-foreground/30',
            'font-sans',
            voiceState === 'listening' && 'placeholder:text-red-400/60'
          )}
        />

        {/* Camera / scan button */}
        <button
          onClick={() => scannerRef.current?.open()}
          aria-label="Scan sticky note"
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all text-muted-foreground/30 hover:text-muted-foreground/60"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        {/* Mic button — only shown when speech recognition is supported */}
        {voiceSupported && (
          <button
            onClick={startListening}
            aria-label={voiceState === 'listening' ? 'Stop listening' : 'Voice input'}
            className={cn(
              'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all',
              voiceState === 'listening'
                ? 'text-red-400 bg-red-500/10'
                : 'text-muted-foreground/30 hover:text-muted-foreground/60'
            )}
          >
            <AnimatePresence mode="wait">
              {voiceState === 'listening' ? (
                <motion.div
                  key="mic-on"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                >
                  <MicOff className="w-3.5 h-3.5" />
                </motion.div>
              ) : (
                <motion.div key="mic-off" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                  <Mic className="w-3.5 h-3.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        )}

        {/* Expand / collapse options */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all',
            expanded
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground/30 hover:text-muted-foreground/60'
          )}
          aria-label="Toggle options"
        >
          {expanded
            ? <X className="w-3.5 h-3.5" />
            : <SlidersHorizontal className="w-3.5 h-3.5" />
          }
        </button>

        <AnimatePresence mode="wait">
          {value.length > 0 && voiceState !== 'listening' && (
            <motion.button
              key="submit"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={handleSubmit}
              disabled={saving}
              className={cn(
                'w-9 h-9 rounded-xl bg-primary flex items-center justify-center',
                'flex-shrink-0 transition-colors hover:bg-primary/90',
                'active:scale-95'
              )}
            >
              <ArrowRight className="w-4 h-4 text-primary-foreground" />
            </motion.button>
          )}

          {showSuccess && (
            <motion.span
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[12px] text-drivn-green/70 flex-shrink-0"
            >
              Added ✓
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      </div>
    </div>
    </>
  )
}
