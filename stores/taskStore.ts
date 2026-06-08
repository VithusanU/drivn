'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { getRecommendedTask, groupTasks, getQuickWins } from '@/lib/engine/recommendation'
import { Analytics } from '@/lib/analytics'
import { localToUTC } from '@/lib/notifications'
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

// due_time is stored/displayed in the user's local time, but the scheduler scans in UTC —
// mirror the chosen local time into alarm_time_utc whenever an alarm is armed (same
// localToUTC conversion used for the daily reminder_time on push_subscriptions).
function deriveAlarmTimeUtc(alarmEnabled: boolean | undefined, dueTime: string | null | undefined): string | null {
  if (!alarmEnabled || !dueTime) return null
  return localToUTC(dueTime)
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
        category: input.category ?? null,
        alarm_enabled: input.alarm_enabled ?? false,
        alarm_time_utc: deriveAlarmTimeUtc(input.alarm_enabled, input.due_time),
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

    // Only the full edit sheet sends `alarm_enabled` (always paired with `due_time`),
    // so recompute the UTC mirror there. Quick-edit surfaces (e.g. TaskScanner) that
    // patch `due_time` alone don't touch alarms — leave alarm_time_utc untouched.
    const payload =
      'alarm_enabled' in input
        ? { ...input, alarm_time_utc: deriveAlarmTimeUtc(input.alarm_enabled, input.due_time) }
        : input

    const { data, error } = await supabase
      .from('tasks')
      .update(payload)
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

    // Log activity for friends feed (fire-and-forget)
    if (task) {
      supabase.from('friend_activities').insert({
        user_id: user.id,
        type: 'task_completed',
        task_title: task.title,
      }).then().catch(() => {})
    }

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
          category: task.category ?? undefined,
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
