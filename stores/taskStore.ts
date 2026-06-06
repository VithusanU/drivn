'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { getRecommendedTask, groupTasks, getQuickWins } from '@/lib/engine/recommendation'
import { Analytics } from '@/lib/analytics'
import type { Task, TaskStore, CreateTaskInput, UpdateTaskInput, TaskGroup, RecommendedTask, TaskRecurrence } from '@/types'

const TASK_LIMIT = 100

// Calculate next due date for recurring tasks
function nextDueDate(currentDate: string | null, recurrence: TaskRecurrence): string | null {
  if (!currentDate || recurrence === 'none') return null
  const d = new Date(currentDate)
  if (recurrence === 'daily') d.setDate(d.getDate() + 1)
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7)
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  hasFetched: false,
  hasMore: false,
  error: null,

  fetchTasks: async () => {
    const supabase = createClient()
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(TASK_LIMIT)

      if (error) throw error
      set({
        tasks: data ?? [],
        isLoading: false,
        hasFetched: true,
        hasMore: (data?.length ?? 0) === TASK_LIMIT,
      })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false, hasFetched: true })
    }
  },

  createTask: async (input: CreateTaskInput) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: input.title,
        description: input.description ?? null,
        urgency: input.urgency ?? 'medium',
        due_date: input.due_date ?? null,
        due_time: input.due_time ?? null,
        estimated_minutes: input.estimated_minutes ?? null,
        blocked_by: input.blocked_by ?? null,
        recurrence: input.recurrence ?? 'none',
      })
      .select()
      .single()

    if (error || !data) return null

    set((state) => ({ tasks: [data, ...state.tasks] }))
    Analytics.taskCreated(input.urgency ?? 'medium')
    return data
  },

  updateTask: async (id: string, input: UpdateTaskInput) => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('tasks')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) return

    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? data : t)),
    }))
  },

  completeTask: async (id: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const task = get().tasks.find((t) => t.id === id)

    // Mark task as completed
    await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)

    // Record streak update via server function
    await supabase.rpc('record_task_completion', { p_user_id: user.id })

    // Remove from local state
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }))
    Analytics.taskCompleted()

    // If recurring, auto-create next occurrence
    if (task && task.recurrence !== 'none') {
      const nextDate = nextDueDate(task.due_date, task.recurrence as TaskRecurrence)
      if (nextDate) {
        await get().createTask({
          title: task.title,
          description: task.description ?? undefined,
          urgency: task.urgency,
          due_date: nextDate,
          due_time: task.due_time,
          estimated_minutes: task.estimated_minutes,
          recurrence: task.recurrence as TaskRecurrence,
        })
      }
    }
  },

  deleteTask: async (id: string) => {
    const supabase = createClient()
    const { tasks } = get()
    const task = tasks.find((t) => t.id === id)

    await supabase
      .from('tasks')
      .update({ status: 'archived' })
      .eq('id', id)

    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }))

    if (task) Analytics.taskAbandoned(task.urgency)
  },

  undoDeleteTask: async (id: string, task) => {
    const supabase = createClient()
    await supabase.from('tasks').update({ status: 'active' }).eq('id', id)
    set((state) => ({ tasks: [{ ...task, status: 'active' }, ...state.tasks] }))
  },

  getRecommendedTask: (): RecommendedTask | null => {
    return getRecommendedTask(get().tasks)
  },

  getQuickWins: (): Task[] => {
    const nba = getRecommendedTask(get().tasks)
    return getQuickWins(get().tasks, nba?.task.id)
  },

  getTasksByGroup: (): Record<TaskGroup, Task[]> => {
    return groupTasks(get().tasks)
  },
}))
