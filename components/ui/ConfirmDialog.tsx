'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className={cn(
              'fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-sm',
              'bg-card border border-border rounded-2xl shadow-xl p-5'
            )}
          >
            <h2 className="text-[15px] font-medium text-foreground">{title}</h2>
            {description && (
              <p className="mt-1.5 text-[13px] text-muted-foreground/70">{description}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={onCancel}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-[13px] font-medium',
                  'bg-secondary text-secondary-foreground',
                  'transition-all active:scale-[0.97]'
                )}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-[13px] font-medium',
                  'bg-primary text-primary-foreground',
                  'transition-all active:scale-[0.97]'
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
