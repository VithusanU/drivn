'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search, X, List, Layers, CheckCircle2, Archive, Lock } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import TaskItem from '@/components/tasks/TaskItem'
import { cn } from '@/lib/utils'
import type { Task, TaskGroup, TaskCategory } from '@/types'
import { TASK_CATEGORIES } from '@/types'

const GROUP_LABELS: Record<TaskGroup, string> = {
  now: 'Now',
  soon: 'Soon',
  later: 'Later',
}

const GROUP_ORDER: TaskGroup[] = ['now', 'soon', 'later']

type ViewMode = 'grouped' | 'flat'

export default function TaskGroups() {
  const [collapsed, setCollapsed] = useState<Record<TaskGroup, boolean>>({
    now: false, soon: false, later: true,
  })
  const [viewMode, setViewMode] = useState<ViewMode>('grouped')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)

  const tasks = useTaskStore((s) => s.tasks)
  const getTasksByGroup = useTaskStore((s) => s.getTasksByGroup)
  const completeTask = useTaskStore((s) => s.completeTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const hasMore = useTaskStore((s) => s.hasMore)
  const groups = getTasksByGroup()

  // ── Search filter — must be above any early return (Rules of Hooks) ──────
  const query = search.trim().toLowerCase()
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status !== 'active') return false
      if (categoryFilter && (t.category ?? 'other') !== categoryFilter) return false
      if (!query) return true
      return t.title.toLowerCase().includes(query) || (t.description ?? '').toLowerCase().includes(query)
    })
  }, [tasks, query, categoryFilter])

  const totalActive = tasks.filter((t) => t.status === 'active').length
  if (totalActive === 0) return null

  // Only show category filters for categories that actually have tasks
  const usedCategories = TASK_CATEGORIES.filter((cat) =>
    tasks.some((t) => t.status === 'active' && (t.category ?? 'other') === cat.value)
  )

  // ── Flat view: actionable vs blocked ────────────────────────────────────
  const blockedTasks = filteredTasks.filter((t) => t.blocked_by && tasks.find((b) => b.id === t.blocked_by && b.status === 'active'))
  const actionableTasks = filteredTasks.filter((t) => !blockedTasks.includes(t))

  const toggleGroup = (group: TaskGroup) =>
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleBulkComplete = async () => {
    if (selectedIds.size === 0) return
    setBulkWorking(true)
    for (const id of selectedIds) await completeTask(id)
    setSelectedIds(new Set())
    setBulkWorking(false)
    setSelectMode(false)
  }

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return
    setBulkWorking(true)
    for (const id of selectedIds) await deleteTask(id)
    setSelectedIds(new Set())
    setBulkWorking(false)
    setSelectMode(false)
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className={cn(
          'flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
          search ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-background/50'
        )}>
          <Search className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="flex-1 min-w-0 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/30 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        {!search && (
          <button
            onClick={() => setViewMode((v) => v === 'grouped' ? 'flat' : 'grouped')}
            className={cn(
              'p-2 rounded-xl border transition-colors',
              viewMode === 'flat'
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border/50 text-muted-foreground/50 hover:text-foreground hover:border-border'
            )}
            title={viewMode === 'grouped' ? 'Switch to flat view' : 'Switch to grouped view'}
          >
            {viewMode === 'grouped' ? <List className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Select mode toggle */}
        {!search && (
          <button
            onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()) }}
            className={cn(
              'px-3 py-2 rounded-xl border text-[11px] font-medium transition-colors',
              selectMode
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'border-border/50 text-muted-foreground/50 hover:text-foreground hover:border-border'
            )}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
        )}
      </div>

      {/* Category filter pills (only if multiple categories used) */}
      {usedCategories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pr-4 pb-0.5">
          <button
            onClick={() => setCategoryFilter(null)}
            className={cn(
              'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border transition-all',
              !categoryFilter
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border/50 text-muted-foreground/50 hover:border-border hover:text-muted-foreground'
            )}
          >
            All
          </button>
          {usedCategories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(categoryFilter === cat.value ? null : cat.value)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium border transition-all',
                categoryFilter === cat.value
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border/50 text-muted-foreground/50 hover:border-border hover:text-muted-foreground'
              )}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Search results / flat view / grouped view */}
      {search || viewMode === 'flat' ? (
        <div className="space-y-1">
          {filteredTasks.length === 0 ? (
            <p className="text-[13px] text-muted-foreground/40 text-center py-4">
              {search ? 'No tasks match that search' : 'No tasks'}
            </p>
          ) : (
            <>
              {actionableTasks.map((task) => (
                <TaskItem key={task.id} task={task} selectMode={selectMode} selected={selectedIds.has(task.id)} onSelect={toggleSelect} />
              ))}
              {blockedTasks.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 py-2">
                    <Lock className="w-3 h-3 text-muted-foreground/30" />
                    <span className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/40">
                      Blocked ({blockedTasks.length})
                    </span>
                  </div>
                  <div className="space-y-1 opacity-60">
                    {blockedTasks.map((task) => (
                      <TaskItem key={task.id} task={task} selectMode={false} selected={false} onSelect={() => {}} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Grouped view */
        <div className="space-y-1">
          {GROUP_ORDER.map((group) => {
            const groupTasks = groups[group]
            const actionable = groupTasks.filter((t) => !t.blocked_by || !tasks.find((b) => b.id === t.blocked_by && b.status === 'active'))
            const blocked = groupTasks.filter((t) => t.blocked_by && tasks.find((b) => b.id === t.blocked_by && b.status === 'active'))
            if (groupTasks.length === 0) return null
            const isCollapsed = collapsed[group]

            return (
              <div key={group}>
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
                        {actionable.map((task) => (
                          <TaskItem key={task.id} task={task} selectMode={selectMode} selected={selectedIds.has(task.id)} onSelect={toggleSelect} />
                        ))}
                        {blocked.length > 0 && (
                          <div className="mt-2 space-y-1 opacity-60">
                            <div className="flex items-center gap-1.5 px-1 py-1">
                              <Lock className="w-3 h-3 text-muted-foreground/30" />
                              <span className="text-[10px] text-muted-foreground/40 font-medium">Blocked</span>
                            </div>
                            {blocked.map((task) => (
                              <TaskItem key={task.id} task={task} selectMode={false} selected={false} onSelect={() => {}} />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      {/* Load more indicator */}
      {hasMore && !search && (
        <p className="text-[11px] text-muted-foreground/40 text-center pt-1">
          Showing first 100 tasks
        </p>
      )}

      {/* Bulk action footer */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            className={cn(
              'fixed bottom-20 md:bottom-6 left-4 right-4 z-30 max-w-sm mx-auto',
              'flex gap-2 p-3 rounded-2xl',
              'bg-card border border-border shadow-xl'
            )}
          >
            <button
              onClick={handleBulkComplete}
              disabled={bulkWorking}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium',
                'bg-drivn-green/15 border border-drivn-green/30 text-drivn-green',
                'transition-all active:scale-[0.97] disabled:opacity-50'
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Complete {selectedIds.size}
            </button>
            <button
              onClick={handleBulkArchive}
              disabled={bulkWorking}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium',
                'bg-secondary border border-border text-muted-foreground',
                'transition-all active:scale-[0.97] disabled:opacity-50'
              )}
            >
              <Archive className="w-3.5 h-3.5" />
              Archive {selectedIds.size}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
