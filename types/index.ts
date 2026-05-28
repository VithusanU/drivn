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
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

export type TaskStatus = 'active' | 'completed' | 'archived'
export type TaskUrgency = 'high' | 'medium' | 'low'
export type TaskGroup = 'now' | 'soon' | 'later'

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
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  urgency?: TaskUrgency
  due_date?: string | null
  due_time?: string | null
  estimated_minutes?: number | null
  status?: TaskStatus
  blocked_by?: string | null
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
  lastCompletedDate: string | null  // most recent completion date before today
}

export interface CreateHabitInput {
  title: string
  emoji: string
  detail_type?: HabitDetailType
  detail_config?: HabitDetailConfig
  priority?: HabitPriority
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
