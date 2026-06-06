'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import { CHANGELOG, APP_VERSION } from '@/lib/version'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ChangelogSheet({ open, onClose }: Props) {
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
              'max-h-[85vh] flex flex-col',
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
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary/70" />
                <div>
                  <h2 className="text-[15px] font-medium text-foreground">What's new</h2>
                  <p className="text-[11px] text-muted-foreground/60">Drivn v{APP_VERSION}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Changelog entries */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 pb-8">
              {CHANGELOG.map((entry, i) => (
                <div key={entry.version}>
                  {/* Version header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-medium border',
                      i === 0
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-secondary border-border text-muted-foreground'
                    )}>
                      v{entry.version}
                    </span>
                    <span className="text-[12px] text-muted-foreground/50">{entry.date}</span>
                    {i === 0 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-drivn-green/10 border border-drivn-green/25 text-drivn-green">
                        Latest
                      </span>
                    )}
                  </div>

                  {/* Changes list */}
                  <ul className="space-y-2">
                    {entry.changes.map((change) => (
                      <li key={change} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0 mt-1.5" />
                        <span className="text-[13px] text-foreground/75 leading-snug">{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
