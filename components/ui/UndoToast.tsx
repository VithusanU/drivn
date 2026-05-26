'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUndoStore } from '@/stores/undoStore'

export default function UndoToast() {
  const { label, onUndo, dismiss } = useUndoStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!label) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => dismiss(), 5000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [label, dismiss])

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onUndo?.()
    dismiss()
  }

  return (
    <AnimatePresence>
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 md:bottom-6 w-max max-w-[calc(100vw-2rem)]"
        >
          <div className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-foreground text-background shadow-xl text-sm">
            <span className="text-background/75">{label}</span>
            <button
              onClick={handleUndo}
              className="font-semibold text-background shrink-0 hover:text-background/80 transition-colors"
            >
              Undo
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
