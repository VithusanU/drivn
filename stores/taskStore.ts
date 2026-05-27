'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { getRecommendedTask, groupTasks, getQuickWins } from '@/lib/engine/recommendation'
import { Analytics } from '@/lib/analytics'
import type { Task, TaskStore, CreateTaskInput, UpdateTaskInput, TaskGroup, RecommendedTask } from '@/types'

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  hasFetched: false,
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

      if (error) throw error
      set({ tasks: data ?? [], isLoading: false, hasFetched: true })
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
