'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HabitWithStreak, HabitCompletionDetails } from '@/types'

const BODY_SECTIONS = [
  { id: 'chest', label: 'Chest', emoji: '💪' },
  { id: 'back', label: 'Back', emoji: '🔙' },
  { id: 'shoulders', label: 'Shoulders', emoji: '🏋️' },
  { id: 'arms', label: 'Arms', emoji: '💪' },
  { id: 'core', label: 'Core', emoji: '🎯' },
  { id: 'legs', label: 'Legs', emoji: '🦵' },
  { id: 'glutes', label: 'Glutes', emoji: '🍑' },
  { id: 'cardio', label: 'Cardio', emoji: '🏃' },
]

const AMOUNT_PRESETS: Record<string, number[]> = {
  ml: [150, 250, 500, 750, 1000],
  oz: [6, 8, 16, 24, 32],
  glasses: [1, 2, 3, 4],
}

interface HabitDetailSheetProps {
  habit: HabitWithStreak
  onConfirm: (details: HabitCompletionDetails) => void
  onClose: () => void
}

export default function HabitDetailSheet({ habit, onConfirm, onClose }: HabitDetailSheetProps) {
  const unit = habit.detail_config?.unit ?? 'ml'
  const maxAmount = habit.detail_config?.target ?? habit.detail_config?.max ?? (unit === 'glasses' ? 8 : unit === 'oz' ? 64 : 2000)

  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [amount, setAmount] = useState<number>(
    AMOUNT_PRESETS[unit]?.[1] ?? 250
  )
  const [note, setNote] = useState('')

  const toggleSection = (id: string) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleConfirm = () => {
    const details: HabitCompletionDetails = {}
    if (habit.detail_type === 'body_sections') {
      details.body_sections = selectedSections
    }
    if (habit.detail_type === 'amount') {
      details.amount = amount
      details.unit = unit
    }
    if (note.trim()) details.note = note.trim()
    onConfirm(details)
  }

  const canConfirm =
    habit.detail_type === 'body_sections'
      ? selectedSections.length > 0
      : true

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-md mx-auto',
          'rounded-t-3xl bg-card border-t border-border',
          'px-5 pt-5 pb-10'
        )}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{habit.emoji}</span>
            <div>
              <p className="text-[15px] font-medium text-foreground">{habit.title}</p>
              <p className="text-[11px] text-muted-foreground">Log today's entry</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body sections detail */}
        {habit.detail_type === 'body_sections' && (
          <div className="space-y-3 mb-6">
            <p className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground/60">
              Muscle groups
            </p>
            <div className="grid grid-cols-4 gap-2">
              {BODY_SECTIONS.map((section) => {
                const isSelected = selectedSections.includes(section.id)
                return (
                  <button
                    key={section.id}
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 py-3 rounded-xl border text-center transition-all',
                      isSelected
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-card/50 border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                  >
                    <span className="text-lg">{section.emoji}</span>
                    <span className="text-[10px] font-medium">{section.label}</span>
                  </button>
                )
              })}
            </div>
            {selectedSections.length > 0 && (
              <p className="text-[11px] text-muted-foreground/50">
                {selectedSections.length} group{selectedSections.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {/* Amount detail */}
        {habit.detail_type === 'amount' && (
          <div className="space-y-3 mb-6">
            <p className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground/60">
              Amount
            </p>

            {/* Quick presets */}
            {AMOUNT_PRESETS[unit] && (
              <div className="flex gap-2 flex-wrap">
                {AMOUNT_PRESETS[unit].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-all',
                      amount === preset
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-foreground'
                    )}
                  >
                    {preset}{unit}
                  </button>
                ))}
              </div>
            )}

            {/* Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground/50">0 {unit}</span>
                <span className="text-[15px] font-medium text-primary">{amount} {unit}</span>
                <span className="text-[12px] text-muted-foreground/50">{maxAmount} {unit}</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxAmount}
                step={unit === 'glasses' ? 1 : unit === 'oz' ? 2 : 50}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full h-1.5 appearance-none rounded-full cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-primary
                  [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_hsl(var(--primary)/0.2)]"
                style={{
                  background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${(amount / maxAmount) * 100}%, hsl(var(--border)) ${(amount / maxAmount) * 100}%, hsl(var(--border)) 100%)`,
                }}
              />
            </div>
          </div>
        )}

        {/* Optional note */}
        <div className="mb-5">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            className={cn(
              'w-full px-3.5 py-2.5 rounded-xl text-[13px]',
              'bg-background border border-border',
              'text-foreground placeholder:text-muted-foreground/40',
              'outline-none focus:border-primary/40 transition-colors'
            )}
          />
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className={cn(
            'w-full py-3.5 rounded-xl text-[14px] font-medium transition-all',
            'bg-drivn-green text-white',
            'active:scale-[0.98] hover:opacity-90',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {habit.detail_type === 'body_sections' && selectedSections.length > 0
            ? `Log ${selectedSections.length} muscle group${selectedSections.length > 1 ? 's' : ''}`
            : habit.detail_type === 'amount'
            ? `Log ${amount} ${unit}`
            : 'Log habit'}
        </button>
      </motion.div>
    </div>
  )
}
