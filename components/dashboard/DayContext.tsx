'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, X, Check, Sparkles, Mic, MicOff } from 'lucide-react'
import { useContextStore } from '@/stores/contextStore'
import { isSpeechRecognitionSupported } from '@/lib/voiceParser'
import { cn } from '@/lib/utils'

type VoiceState = 'idle' | 'listening' | 'done'

export default function DayContext() {
  const contextText = useContextStore((s) => s.contextText)
  const setContext = useContextStore((s) => s.setContext)
  const clearContext = useContextStore((s) => s.clearContext)
  const hydrate = useContextStore((s) => s.hydrate)

  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [interimText, setInterimText] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null)

  useEffect(() => {
    hydrate()
    setVoiceSupported(isSpeechRecognitionSupported())
  }, [])

  useEffect(() => {
    return () => { recognitionRef.current?.abort() }
  }, [])

  const handleOpen = () => {
    setDraft(contextText)
    setExpanded(true)
    setTimeout(() => textareaRef.current?.focus(), 120)
  }

  const handleSave = () => {
    stopListening()
    const trimmed = draft.trim()
    if (trimmed) setContext(trimmed)
    else clearContext()
    setExpanded(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') { stopListening(); setExpanded(false) }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    clearContext()
    setExpanded(false)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setVoiceState('idle')
    setInterimText('')
  }

  const startListening = () => {
    if (!voiceSupported) return
    if (voiceState === 'listening') { stopListening(); return }

    const SR = (window.SpeechRecognition ?? (window as any).webkitSpeechRecognition) as typeof window.SpeechRecognition
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => { setVoiceState('listening'); setInterimText('') }

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      setInterimText(interim)
      if (final) {
        setVoiceState('done')
        setInterimText('')
        setDraft((prev) => (prev ? `${prev.trim()} ${final.trim()}` : final.trim()))
        // Auto-expand if not already open
        setExpanded(true)
      }
    }

    recognition.onerror = () => stopListening()
    recognition.onend = () => {
      recognitionRef.current = null
      setVoiceState((s) => s === 'listening' ? 'idle' : s)
      setInterimText('')
    }

    recognitionRef.current = recognition
    recognition.start()

    // Auto-expand text box when voice starts
    setExpanded(true)
    setDraft(contextText)
  }

  // ── Filled / compact state ────────────────────────────────────────────────
  if (contextText && !expanded) {
    return (
      <motion.button
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={handleOpen}
        className={cn(
          'w-full flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-left',
          'bg-primary/5 border border-primary/15',
          'hover:bg-primary/8 hover:border-primary/25 transition-colors'
        )}
      >
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          <Sparkles className="w-3 h-3 text-primary/60" />
          <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-primary/50">
            Context
          </span>
        </div>
        <p className="flex-1 text-[12px] text-foreground/60 leading-relaxed line-clamp-2 min-w-0">
          {contextText}
        </p>
        <button
          onClick={handleClear}
          className="flex-shrink-0 mt-0.5 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          aria-label="Clear context"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.button>
    )
  }

  // ── Expanded / input state ────────────────────────────────────────────────
  if (expanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="rounded-xl border border-primary/25 bg-card overflow-hidden"
      >
        <div className="px-3.5 pt-3 pb-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3 h-3 text-primary/60" />
            <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-primary/60">
              What&apos;s happening today?
            </p>
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              voiceState === 'listening'
                ? (interimText || 'Listening…')
                : 'e.g. dentist at 3pm, low energy this morning, big meeting at 11am…'
            }
            rows={3}
            className={cn(
              'w-full bg-transparent outline-none resize-none',
              'text-[13px] text-foreground/70 leading-relaxed',
              voiceState === 'listening'
                ? 'placeholder:text-red-400/60'
                : 'placeholder:text-muted-foreground/30'
            )}
          />
        </div>
        <div className="flex items-center justify-between px-3.5 py-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground/30">
              AI adapts around this
            </p>
            {/* Mic button */}
            {voiceSupported && (
              <button
                onClick={startListening}
                aria-label={voiceState === 'listening' ? 'Stop listening' : 'Dictate context'}
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                  voiceState === 'listening'
                    ? 'text-red-400 bg-red-500/10'
                    : 'text-muted-foreground/40 hover:text-muted-foreground/60'
                )}
              >
                {voiceState === 'listening' ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                  >
                    <MicOff className="w-3.5 h-3.5" />
                  </motion.div>
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { stopListening(); setExpanded(false) }}
              className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                draft.trim()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground/40'
              )}
            >
              <Check className="w-3 h-3" />
              Set
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Empty / prompt state ──────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleOpen}
        className={cn(
          'flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl',
          'border border-dashed border-border/40',
          'text-muted-foreground/30 hover:text-muted-foreground/50 hover:border-border/60',
          'transition-all text-left'
        )}
      >
        <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-[12px]">Anything happening today? Tell the AI…</span>
      </button>

      {/* Mic shortcut — tap to dictate without opening the text box first */}
      {voiceSupported && (
        <button
          onClick={startListening}
          aria-label="Dictate today's context"
          className={cn(
            'w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all',
            voiceState === 'listening'
              ? 'border-red-500/40 bg-red-500/10 text-red-400'
              : 'border-dashed border-border/40 text-muted-foreground/30 hover:text-muted-foreground/50 hover:border-border/60'
          )}
        >
          {voiceState === 'listening' ? (
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
              <MicOff className="w-3.5 h-3.5" />
            </motion.div>
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  )
}
