// ─── User & Auth ───────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  last_active_date: string | null
  onboarded_at: string | null
  beta_access: boolean
  anthropic_key_masked: string | null
  username: string | null
  share_activity: boolean
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

export type TaskStatus = 'active' | 'completed' | 'archived'
export type TaskUrgency = 'high' | 'medium' | 'low'
export type TaskGroup = 'now' | 'soon' | 'later'
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'
export type TaskCategory = 'work' | 'personal' | 'health' | 'learning' | 'other'

export const TASK_CATEGORIES: { value: TaskCategory; label: string; emoji: string }[] = [
  { value: 'work',     label: 'Work',     emoji: '💼' },
  { value: 'personal', label: 'Personal', emoji: '🏠' },
  { value: 'health',   label: 'Health',   emoji: '💪' },
  { value: 'learning', label: 'Learning', emoji: '📚' },
  { value: 'other',    label: 'Other',    emoji: '📌' },
]

export interface Task {
  id: string
  user_id: string
  title: string
  description: string | null
  status: TaskStatus
  urgency: TaskUrgency
  due_date: string | null
  due_time: string | null
  estimated_minutes: number | null
  recurrence: TaskRecurrence
  category: TaskCategory | null
  created_at: string
  updated_at: string
  completed_at: string | null
  last_engaged_at: string | null
  blocked_by: string | null
}

export interface CreateTaskInput {
  title: string
  description?: string
  urgency?: TaskUrgency
  due_date?: string | null
  due_time?: string | null
  estimated_minutes?: number | null
  blocked_by?: string | null
  recurrence?: TaskRecurrence
  category?: TaskCategory | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  urgency?: TaskUrgency
  due_date?: string | null
  due_time?: string | null
  estimated_minutes?: number | null
  status?: TaskStatus
  blocked_by?: string | null
  recurrence?: TaskRecurrence
}

// Derived — computed client-side
export interface TaskWithGroup extends Task {
  group: TaskGroup
}

// ─── Habits ────────────────────────────────────────────────────────────────

export type HabitDetailType = 'none' | 'body_sections' | 'amount'
export type HabitPriority = 'essential' | 'nice_to_have'

export interface HabitDetailConfig {
  unit?: string
  max?: number
  target?: number
}

export interface Habit {
  id: string
  user_id: string
  title: string
  emoji: string
  created_at: string
  active: boolean
  order_index: number
  detail_type: HabitDetailType
  detail_config: HabitDetailConfig | null
  priority: HabitPriority
}

export interface HabitCompletionDetails {
  body_sections?: string[]
  amount?: number
  unit?: string
  note?: string
}

export interface HabitCompletion {
  id: string
  habit_id: string
  completed_date: string
  details?: HabitCompletionDetails | null
}

export interface HabitWithStreak extends Habit {
  completedToday: boolean
  currentStreak: number
  lastDetails?: HabitCompletionDetails | null
  lastCompletedDate: string | null
}

export interface CreateHabitInput {
  title: string
  emoji: string
  detail_type?: HabitDetailType
  detail_config?: HabitDetailConfig
  priority?: HabitPriority
}

// ─── Events ────────────────────────────────────────────────────────────────

export type EventCategory = 'appointment' | 'maintenance' | 'personal' | 'health' | 'other'
export type EventRecurrence = 'none' | 'weekly' | 'monthly' | 'custom'

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  event_date: string     // YYYY-MM-DD
  event_time: string | null  // HH:MM
  category: EventCategory
  recurrence: EventRecurrence
  recurrence_days: number | null   // for 'custom' recurrence
  notes: string | null
  created_at: string
}

export interface CreateEventInput {
  title: string
  event_date: string
  event_time?: string | null
  category?: EventCategory
  recurrence?: EventRecurrence
  recurrence_days?: number | null
  notes?: string | null
}

export interface UpdateEventInput {
  title?: string
  event_date?: string
  event_time?: string | null
  category?: EventCategory
  recurrence?: EventRecurrence
  recurrence_days?: number | null
  notes?: string | null
}

export interface EventStore {
  events: CalendarEvent[]
  isLoading: boolean
  hasFetched: boolean
  fetchEvents: () => Promise<void>
  createEvent: (input: CreateEventInput) => Promise<CalendarEvent | null>
  updateEvent: (id: string, input: UpdateEventInput) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  undoDeleteEvent: (id: string, event: CalendarEvent) => Promise<void>
  getUpcomingEvents: (days?: number) => CalendarEvent[]
}

// ─── Focus Sessions ────────────────────────────────────────────────────────

export interface FocusSession {
  id: string
  user_id: string
  task_id: string | null
  task_title: string
  started_at: string
  ended_at: string | null
  minutes_logged: number | null
  created_at: string
}

// ─── Streaks ───────────────────────────────────────────────────────────────

export interface UserStreak {
  user_id: string
  current_streak: number
  longest_streak: number
  last_completion_date: string | null
  tasks_completed_today: number
  total_tasks_completed: number
}

// ─── Scanner ───────────────────────────────────────────────────────────────

export interface ScannedTask {
  title: string
  due_date: string | null
  due_time: string | null
  estimated_minutes: number | null
  urgency: TaskUrgency
}

// ─── Beta Access ───────────────────────────────────────────────────────────

export interface BetaRequest {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  status: 'pending' | 'approved' | 'denied'
  requested_at: string
  reviewed_at: string | null
}

export interface AIRecommendation {
  taskId: string
  reason: string
  quickWinIds: string[]
  limitReached?: boolean
}

// ─── Recommendation Engine ─────────────────────────────────────────────────

export interface RecommendedTask {
  task: Task
  reason: RecommendationReason
  score: number
}

export type RecommendationReason =
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'recently_active'
  | 'high_urgency'

// ─── Store Types ───────────────────────────────────────────────────────────

export interface TaskStore {
  tasks: Task[]
  isLoading: boolean
  hasFetched: boolean
  hasMore: boolean
  error: string | null
  fetchTasks: () => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<Task | null>
  updateTask: (id: string, input: UpdateTaskInput) => Promise<void>
  completeTask: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  undoDeleteTask: (id: string, task: Task) => Promise<void>
  getRecommendedTask: () => RecommendedTask | null
  getQuickWins: () => Task[]
  getTasksByGroup: () => Record<TaskGroup, Task[]>
}

export interface HabitStore {
  habits: Habit[]
  completions: HabitCompletion[]
  lastCompletions: HabitCompletion[]
  isLoading: boolean
  fetchHabits: () => Promise<void>
  fetchTodayCompletions: () => Promise<void>
  toggleHabit: (habitId: string, details?: HabitCompletionDetails) => Promise<void>
  createHabit: (input: CreateHabitInput) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  undoDeleteHabit: (id: string, habit: Habit) => Promise<void>
  updateHabitPriority: (id: string, priority: HabitPriority) => Promise<void>
  getHabitsWithStreaks: () => HabitWithStreak[]
}

export interface UserStore {
  profile: UserProfile | null
  streak: UserStreak | null
  isLoading: boolean
  fetchProfile: () => Promise<void>
  fetchStreak: () => Promise<void>
  updateStreak: () => Promise<void>
  markOnboarded: () => Promise<void>
  betaModeEnabled: boolean
  toggleBetaMode: () => void
  requestBetaAccess: () => Promise<'ok' | 'already_requested' | 'error'>
  saveApiKey: (key: string) => Promise<'ok' | 'invalid' | 'error'>
  removeApiKey: () => Promise<void>
}

// ─── AI Store ──────────────────────────────────────────────────────────────

export interface AIStore {
  recommendation: AIRecommendation | null
  fetching: boolean
  fetchRecommendation: (tasks: Task[], force?: boolean) => Promise<void>
  clear: () => void
}

// ─── Session Store ─────────────────────────────────────────────────────────

export interface SessionStore {
  skippedTaskIds: string[]
  skipTask: (id: string) => void
  clearSkipped: () => void
}
