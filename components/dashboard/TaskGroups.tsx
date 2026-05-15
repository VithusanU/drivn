'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import TaskItem from '@/components/tasks/TaskItem'
import { cn } from '@/lib/utils'
import type { TaskGroup } from '@/types'

const GROUP_LABELS: Record<TaskGroup, string> = {
  now: 'Now',
  soon: 'Soon',
  later: 'Later',
}

const GROUP_ORDER: TaskGroup[] = ['now', 'soon', 'later']

export default function TaskGroups() {
  const [collapsed, setCollapsed] = useState<Record<TaskGroup, boolean>>({
    now: false,
    soon: false,
    later: true,
  })
  const tasks = useTaskStore((s) => s.tasks) // reactive
  const getTasksByGroup = useTaskStore((s) => s.getTasksByGroup)
  const groups = getTasksByGroup()

  const totalActive = tasks.filter((t) => t.status === 'active').length
  if (totalActive === 0) return null

  const toggleGroup = (group: TaskGroup) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  return (
    <div className="space-y-1">
      {GROUP_ORDER.map((group) => {
        const groupTasks = groups[group]
        if (groupTasks.length === 0) return null
        const isCollapsed = collapsed[group]

        return (
          <div key={group}>
            {/* Section header */}
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between py-2 touch-target"
            >
              <span className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
                {GROUP_LABELS[group]}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground/50">
                  {groupTasks.length} task{groupTasks.length !== 1 ? 's' : ''}
                </span>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 text-muted-foreground/30 transition-transform duration-200',
                    isCollapsed && '-rotate-90'
                  )}
                />
              </div>
            </button>

            {/* Task list */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  key={`${group}-list`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 pb-1">
                    {groupTasks.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
