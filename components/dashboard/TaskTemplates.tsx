'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Loader2 } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { cn } from '@/lib/utils'

interface Template {
  name: string
  emoji: string
  description: string
  tasks: { title: string; urgency: 'high' | 'medium' | 'low'; estimated_minutes?: number }[]
}

const TEMPLATES: Template[] = [
  {
    name: 'Morning routine',
    emoji: '🌅',
    description: '4 tasks to start your day right',
    tasks: [
      { title: 'Review today\'s tasks and priorities', urgency: 'high', estimated_minutes: 10 },
      { title: 'Check and reply to urgent emails', urgency: 'medium', estimated_minutes: 15 },
      { title: 'Block focus time on calendar', urgency: 'medium', estimated_minutes: 5 },
      { title: 'Set your #1 goal for today', urgency: 'high', estimated_minutes: 5 },
    ],
  },
  {
    name: 'Weekly review',
    emoji: '📋',
    description: '5 tasks for your end-of-week review',
    tasks: [
      { title: 'Review completed tasks this week', urgency: 'medium', estimated_minutes: 15 },
      { title: 'Clear your inbox to zero', urgency: 'medium', estimated_minutes: 30 },
      { title: 'Update next week\'s priorities', urgency: 'high', estimated_minutes: 20 },
      { title: 'Review ongoing projects status', urgency: 'medium', estimated_minutes: 15 },
      { title: 'Plan social or personal commitments', urgency: 'low', estimated_minutes: 10 },
    ],
  },
  {
    name: 'Project kickoff',
    emoji: '🚀',
    description: '4 tasks to start a new project',
    tasks: [
      { title: 'Define project goals and success criteria', urgency: 'high', estimated_minutes: 30 },
      { title: 'Break project into milestones', urgency: 'high', estimated_minutes: 45 },
      { title: 'Identify blockers and dependencies', urgency: 'medium', estimated_minutes: 20 },
      { title: 'Set first deadline and share with stakeholders', urgency: 'medium', estimated_minutes: 15 },
    ],
  },
  {
    name: 'Deep work block',
    emoji: '🧠',
    description: '3 tasks for a focused session',
    tasks: [
      { title: 'Silence notifications and set status to busy', urgency: 'high', estimated_minutes: 5 },
      { title: 'Write down the one thing to accomplish', urgency: 'high', estimated_minutes: 5 },
      { title: 'Start 90-minute deep work session', urgency: 'high', estimated_minutes: 90 },
    ],
  },
  {
    name: 'Inbox zero',
    emoji: '📬',
    description: '3 tasks to clear your inbox',
    tasks: [
      { title: 'Process and reply to urgent emails', urgency: 'high', estimated_minutes: 20 },
      { title: 'Archive or delete non-actionable emails', urgency: 'medium', estimated_minutes: 15 },
      { title: 'Unsubscribe from unnecessary mailing lists', urgency: 'low', estimated_minutes: 10 },
    ],
  },
  {
    name: 'End of day wrap-up',
    emoji: '🌙',
    description: '3 tasks to close your workday',
    tasks: [
      { title: 'Update task statuses and notes', urgency: 'medium', estimated_minutes: 10 },
      { title: 'Write 3 wins from today', urgency: 'low', estimated_minutes: 5 },
      { title: 'Set top priority for tomorrow', urgency: 'high', estimated_minutes: 5 },
    ],
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function TaskTemplates({ open, onClose }: Props) {
  const createTask = useTaskStore((s) => s.createTask)
  const [selected, setSelected] = useState<Template | null>(null)
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState(false)

  const handleAdd = async () => {
    if (!selected || adding) return
    setAdding(true)
    await Promise.all(
      selected.tasks.map((t) =>
        createTask({
          title: t.title,
          urgency: t.urgency,
          estimated_minutes: t.estimated_minutes ?? null,
        })
      )
    )
    setAdding(false)
    setDone(true)
    setTimeout(() => {
      setDone(false)
      setSelected(null)
      onClose()
    }, 1200)
  }

  const handleClose = () => {
    setSelected(null)
    setDone(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'max-h-[85dvh] flex flex-col',
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
              <div>
                <h2 className="text-[15px] font-medium text-foreground">Templates</h2>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Add a set of tasks instantly</p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template list or confirm view */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {!selected ? (
                <div className="space-y-2">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.name}
                      onClick={() => setSelected(template)}
                      className={cn(
                        'w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all',
                        'bg-background/50 border-border/50 hover:bg-card hover:border-border active:scale-[0.99]'
                      )}
                    >
                      <span className="text-2xl">{template.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-foreground">{template.name}</p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">{template.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => setSelected(null)}
                    className="text-[12px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    ← Back to templates
                  </button>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{selected.emoji}</span>
                    <div>
                      <p className="text-[16px] font-medium text-foreground">{selected.name}</p>
                      <p className="text-[12px] text-muted-foreground/50">{selected.tasks.length} tasks will be added</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selected.tasks.map((task, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-border/40 bg-background/50"
                      >
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          task.urgency === 'high' ? 'bg-destructive' : task.urgency === 'medium' ? 'bg-amber-400' : 'bg-muted-foreground/30'
                        )} />
                        <p className="text-[13px] text-foreground/80 flex-1">{task.title}</p>
                        {task.estimated_minutes && (
                          <span className="text-[11px] text-muted-foreground/40">
                            {task.estimated_minutes < 60 ? `${task.estimated_minutes}m` : `${Math.floor(task.estimated_minutes / 60)}h`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer — only shown when a template is selected */}
            {selected && (
              <div className="px-4 pt-4 pb-safe flex-shrink-0 border-t border-border/50">
                <button
                  onClick={handleAdd}
                  disabled={adding || done}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl',
                    'text-[15px] font-medium transition-all active:scale-[0.98]',
                    done
                      ? 'bg-drivn-green text-white'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                    'disabled:opacity-80'
                  )}
                >
                  {adding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : done ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {done ? 'Added!' : adding ? 'Adding…' : `Add ${selected.tasks.length} tasks`}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
