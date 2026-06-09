'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarClock, X, Check, Sparkles } from 'lucide-react'
import { useContextStore } from '@/stores/contextStore'
import { cn } from '@/lib/utils'

export default function DayContext() {
  const contextText = useContextStore((s) => s.contextText)
  const setContext = useContextStore((s) => s.setContext)
  const clearContext = useContextStore((s) => s.clearContext)
  const hydrate = useContextStore((s) => s.hydrate)

  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load from localStorage on mount
  useEffect(() => {
    hydrate()
  }, [])

  const handleOpen = () => {
    setDraft(contextText)
    setExpanded(true)
    // Focus after animation
    setTimeout(() => textareaRef.current?.focus(), 120)
  }

  const handleSave = () => {
    const trimmed = draft.trim()
    if (trimmed) {
      setContext(trimmed)
    } else {
      clearContext()
    }
    setExpanded(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setExpanded(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    clearContext()
    setExpanded(false)
  }

  // ── Filled state ─────────────────────────────────────────────────────────────
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

  // ── Expanded / input state ────────────────────────────────────────────────────
  if (expanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.99 }}
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
            placeholder="e.g. dentist at 3pm, low energy this morning, working from café until noon…"
            rows={3}
            className={cn(
              'w-full bg-transparent outline-none resize-none',
              'text-[13px] text-foreground/70 placeholder:text-muted-foreground/30',
              'leading-relaxed'
            )}
          />
        </div>
        <div className="flex items-center justify-between px-3.5 py-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/30">
            AI will adapt recommendations around this
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(false)}
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

  // ── Empty / prompt state ──────────────────────────────────────────────────────
  return (
    <button
      onClick={handleOpen}
      className={cn(
        'w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl',
        'border border-dashed border-border/40',
        'text-muted-foreground/30 hover:text-muted-foreground/50 hover:border-border/60',
        'transition-all'
      )}
    >
      <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="text-[12px]">Anything happening today? Tell the AI…</span>
    </button>
  )
}
