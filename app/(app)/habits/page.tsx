'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { useHabitStore } from '@/stores/habitStore'
import HabitCard from '@/components/habits/HabitCard'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { HabitDetailType } from '@/types'

const EMOJI_OPTIONS = ['🏋️', '💧', '📖', '🧘', '✍️', '🥗', '😴', '🚶', '🎨', '💊', '🏃', '🧹', '☕', '🎵', '🌿', '🧘', '🏊', '🚴', '🥤', '🫁']

const DETAIL_TYPES: { value: HabitDetailType; label: string; description: string }[] = [
  { value: 'none', label: 'Simple', description: 'Just mark it done' },
  { value: 'body_sections', label: 'Muscle groups', description: 'Log which areas you worked' },
  { value: 'amount', label: 'Amount', description: 'Track how much (water, servings, etc.)' },
]

export default function HabitsPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEmoji, setNewEmoji] = useState('✅')
  const [detailType, setDetailType] = useState<HabitDetailType>('none')
  const [unit, setUnit] = useState('ml')
  const createHabit = useHabitStore((s) => s.createHabit)
  const getHabitsWithStreaks = useHabitStore((s) => s.getHabitsWithStreaks)

  const habits = getHabitsWithStreaks()
  const completedCount = habits.filter((h) => h.completedToday).length

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    await createHabit({
      title: newTitle.trim(),
      emoji: newEmoji,
      detail_type: detailType,
      detail_config: detailType === 'amount' ? { unit } : undefined,
    })
    setNewTitle('')
    setNewEmoji('✅')
    setDetailType('none')
    setUnit('ml')
    setShowAdd(false)
  }

  const handleClose = () => {
    setShowAdd(false)
    setNewTitle('')
    setNewEmoji('✅')
    setDetailType('none')
    setUnit('ml')
  }

  return (
    <div className="px-4 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-[22px] font-medium text-foreground">Habits</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMM d')}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="p-2 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[13px] text-muted-foreground/60 mb-5">
        {completedCount} of {habits.length} complete today
      </p>

      {habits.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-sm font-medium text-foreground mb-1">No habits yet</p>
          <p className="text-xs text-muted-foreground">Add your first habit to start tracking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {habits.map((habit) => (
            <HabitCard key={habit.id} habit={habit} />
          ))}
        </div>
      )}

      {/* Add habit sheet */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={handleClose}>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full rounded-t-3xl bg-card border-t border-border p-5 pb-10',
                'max-w-md mx-auto max-h-[90vh] overflow-y-auto'
              )}
            >
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />

              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-medium">New habit</h2>
                <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Emoji slider */}
              <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-muted-foreground/60 mb-2">
                Icon
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5 -mx-5 px-5">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setNewEmoji(emoji)}
                    className={cn(
                      'text-2xl w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center transition-all',
                      newEmoji === emoji
                        ? 'bg-primary/15 border-2 border-primary/50 scale-110'
                        : 'bg-secondary border border-border'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Name */}
              <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-muted-foreground/60 mb-2">
                Name
              </p>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Habit name"
                autoFocus
                className={cn(
                  'w-full px-4 py-3 rounded-xl mb-5 text-sm',
                  'bg-background border border-border text-foreground',
                  'placeholder:text-muted-foreground/50 outline-none',
                  'focus:border-primary/50 transition-colors'
                )}
              />

              {/* Detail type */}
              <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-muted-foreground/60 mb-2">
                Tracking type
              </p>
              <div className="space-y-2 mb-5">
                {DETAIL_TYPES.map((dt) => (
                  <button
                    key={dt.value}
                    onClick={() => setDetailType(dt.value)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
                      detailType === dt.value
                        ? 'bg-primary/10 border-primary/40'
                        : 'bg-background border-border hover:border-border/80'
                    )}
                  >
                    <div>
                      <p className={cn(
                        'text-[13px] font-medium',
                        detailType === dt.value ? 'text-primary' : 'text-foreground'
                      )}>
                        {dt.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">{dt.description}</p>
                    </div>
                    <div className={cn(
                      'w-4 h-4 rounded-full border-[1.5px] flex-shrink-0 ml-3',
                      detailType === dt.value
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/30'
                    )} />
                  </button>
                ))}
              </div>

              {/* Unit input for amount type */}
              {detailType === 'amount' && (
                <div className="mb-5">
                  <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-muted-foreground/60 mb-2">
                    Unit
                  </p>
                  <div className="flex gap-2">
                    {['ml', 'oz', 'glasses', 'servings'].map((u) => (
                      <button
                        key={u}
                        onClick={() => setUnit(u)}
                        className={cn(
                          'flex-1 py-2 rounded-xl border text-[12px] font-medium transition-all',
                          unit === u
                            ? 'bg-primary/10 border-primary/40 text-primary'
                            : 'border-border/50 text-muted-foreground/60 hover:border-border'
                        )}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleAdd}
                disabled={!newTitle.trim()}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-medium',
                  'bg-primary text-primary-foreground',
                  'transition-all active:scale-[0.98]',
                  'disabled:opacity-40'
                )}
              >
                Add habit
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
