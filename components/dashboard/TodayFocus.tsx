'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CalendarClock, Flame } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { formatDueDate, cn } from '@/lib/utils'

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TodayFocus() {
  const tasks = useTaskStore((s) => s.tasks)
  const router = useRouter()

  const today = getTodayStr()

  // Include tasks due today, AND hard deadline tasks that are overdue
  const todayTasks = tasks.filter((t) => {
    if (t.status !== 'active') return false
    const dueToday = t.due_date === today
    const overdueHardDeadline = t.is_hard_deadline && t.due_date != null && t.due_date < today
    return dueToday || overdueHardDeadline
  })

  // Hard deadlines first, then by due_date ascending
  const sorted = [...todayTasks].sort((a, b) => {
    if (a.is_hard_deadline && !b.is_hard_deadline) return -1
    if (!a.is_hard_deadline && b.is_hard_deadline) return 1
    return (a.due_date ?? '').localeCompare(b.due_date ?? '')
  })

  if (sorted.length === 0) return null

  const hardCount = sorted.filter((t) => t.is_hard_deadline).length

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60">
            Today&apos;s focus
          </p>
          {hardCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-red-400/80 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
              <Flame className="w-2.5 h-2.5" />
              {hardCount}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground/40">
          {sorted.length} task{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-1.5">
        {sorted.slice(0, 6).map((task, i) => (
          <motion.button
            key={task.id}
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => router.push(`/focus/${task.id}`)}
            className={cn(
              'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors',
              'border',
              task.is_hard_deadline
                ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/8 hover:border-red-500/30 active:scale-[0.99]'
                : 'bg-card/50 border-border/50 hover:bg-card hover:border-border active:scale-[0.99]'
            )}
          >
            {task.is_hard_deadline ? (
              <Flame className="w-3.5 h-3.5 text-red-400/70 flex-shrink-0" />
            ) : (
              <CalendarClock className="w-3.5 h-3.5 text-primary/40 flex-shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-[13px] truncate',
                task.is_hard_deadline ? 'text-foreground/80' : 'text-foreground/70'
              )}>
                {task.title}
              </p>
              {task.due_date && (
                <p className={cn(
                  'text-[11px] mt-0.5',
                  task.is_hard_deadline && task.due_date < today
                    ? 'text-red-400/70'
                    : 'text-muted-foreground/40'
                )}>
                  {task.is_hard_deadline && task.due_date < today
                    ? `Overdue · ${formatDueDate(task.due_date, task.due_time)}`
                    : formatDueDate(task.due_date, task.due_time)}
                </p>
              )}
            </div>

            {task.is_hard_deadline && (
              <span className="text-[10px] font-medium text-red-400/70 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
                Hard deadline
              </span>
            )}
          </motion.button>
        ))}

        {sorted.length > 6 && (
          <p className="text-[11px] text-muted-foreground/40 text-center pt-1">
            +{sorted.length - 6} more
          </p>
        )}
      </div>
    </section>
  )
}
