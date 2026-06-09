'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Heart, Zap, Repeat, Bell } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import { subscribeToPush } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'

type Deadline = 'today' | 'tomorrow' | 'this_week' | 'none'

const DEADLINE_PILLS: { label: string; value: Deadline }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'This week', value: 'this_week' },
  { label: 'No deadline', value: 'none' },
]

function getDateValue(deadline: Deadline): string | null {
  if (deadline === 'none') return null
  const d = new Date()
  if (deadline === 'today') return d.toISOString().split('T')[0]
  if (deadline === 'tomorrow') {
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }
  // this_week → end of current week (Sunday)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day))
  return d.toISOString().split('T')[0]
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReplay = searchParams.get('replay') === 'true'

  const [step, setStep] = useState(0)
  const [taskTitle, setTaskTitle] = useState('')
  const [deadline, setDeadline] = useState<Deadline | null>(null)
  const [createdTask, setCreatedTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const [notifState, setNotifState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')

  const createTask = useTaskStore((s) => s.createTask)
  const completeTask = useTaskStore((s) => s.completeTask)
  const markOnboarded = useUserStore((s) => s.markOnboarded)
  const fetchStreak = useUserStore((s) => s.fetchStreak)

  const handleAddTask = async () => {
    const trimmed = taskTitle.trim()
    if (!trimmed || saving) return
    setSaving(true)
    const task = await createTask({
      title: trimmed,
      urgency: 'high',
      due_date: deadline ? getDateValue(deadline) : null,
    })
    setSaving(false)
    if (task) {
      setCreatedTask(task)
      setStep(2)
    }
  }

  const handleSkip = () => setStep(3)

  const handleMarkDone = async () => {
    if (!createdTask || saving) return
    setSaving(true)
    await completeTask(createdTask.id)
    await fetchStreak()
    setSaving(false)
    setStep(3) // habits step
  }

  const handleEnableNotifs = async () => {
    setNotifState('requesting')
    const ok = await subscribeToPush()
    setNotifState(ok ? 'granted' : 'denied')
    setTimeout(() => setStep(5), 1200)
  }

  const handleFinish = async () => {
    if (!isReplay) await markOnboarded()
    router.push('/')
  }

  const slideVariants = {
    enter: { opacity: 0, x: 24 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto px-6">
      {/* Progress bar */}
      <div className="flex gap-1.5 pt-8 pb-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 rounded-full transition-all duration-300',
              i === step
                ? 'flex-[2] bg-primary'
                : i < step
                  ? 'flex-1 bg-primary/35'
                  : 'flex-1 bg-muted'
            )}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col pb-10">
        <AnimatePresence mode="wait">

          {/* ── Screen 1: Value prop ────────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key="step0"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22 }}
              className="flex flex-col flex-1 pt-8"
            >
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-5">
                Welcome
              </p>
              <h1 className="text-[28px] font-medium text-foreground leading-snug mb-3">
                Most apps help you plan.<br />Drivn helps you start.
              </h1>
              <p className="text-[14px] text-muted-foreground leading-relaxed mb-8">
                You already know what needs doing. Drivn tells you what to do right now — no lists to sort, no system to maintain.
              </p>

              <div className="bg-secondary/60 rounded-2xl p-4 space-y-3.5">
                <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-muted-foreground/70">
                  What Drivn does differently
                </p>
                {[
                  { positive: false, text: 'No folders, tags, or setup' },
                  { positive: false, text: 'No deciding what to do next' },
                  { positive: true, text: 'One recommended task, always ready' },
                ].map(({ positive, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <span className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                      positive
                        ? 'bg-drivn-green/15 text-drivn-green'
                        : 'bg-destructive/10 text-destructive'
                    )}>
                      {positive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </span>
                    <span className="text-[13px] text-foreground/80">{text}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-8">
                <button
                  onClick={() => setStep(1)}
                  className="w-full py-4 rounded-2xl border border-border text-[15px] font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Get started
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Screen 2: Task capture ──────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22 }}
              className="flex flex-col flex-1 pt-8"
            >
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-5">
                Add your first task
              </p>
              <h1 className="text-[26px] font-medium text-foreground leading-snug mb-2">
                What's one thing you need to do today?
              </h1>
              <p className="text-[14px] text-muted-foreground leading-relaxed mb-6">
                Just type it. No categories needed — Drivn figures out priority automatically.
              </p>

              <input
                autoFocus
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && taskTitle.trim() && handleAddTask()}
                placeholder='e.g. "Finish stats assignment"'
                className={cn(
                  'w-full px-4 py-3.5 rounded-xl border text-[14px] mb-5',
                  'bg-background text-foreground placeholder:text-muted-foreground/40',
                  'outline-none transition-colors',
                  taskTitle ? 'border-primary/40' : 'border-border'
                )}
              />

              <p className="text-[12px] text-muted-foreground mb-3">When is it due? (optional)</p>
              <div className="flex flex-wrap gap-2">
                {DEADLINE_PILLS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setDeadline(deadline === value ? null : value)}
                    className={cn(
                      'px-4 py-2 rounded-full border text-[13px] font-medium transition-all',
                      deadline === value
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'border-border/60 text-muted-foreground hover:border-primary/30 hover:text-primary/70'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-8 space-y-3">
                <button
                  onClick={handleAddTask}
                  disabled={!taskTitle.trim() || saving}
                  className="w-full py-4 rounded-2xl border border-border text-[15px] font-medium text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-40"
                >
                  {saving ? 'Adding…' : 'Add task'}
                </button>
                <button
                  onClick={handleSkip}
                  className="w-full py-2 text-[13px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Screen 3: NBA reveal ────────────────────────────────── */}
          {step === 2 && createdTask && (
            <motion.div
              key="step2"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22 }}
              className="flex flex-col flex-1 pt-8"
            >
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-5">
                Your next best action
              </p>
              <h1 className="text-[26px] font-medium text-foreground leading-snug mb-2">
                This is how Drivn works.
              </h1>
              <p className="text-[14px] text-muted-foreground leading-relaxed mb-6">
                Every time you open the app, we surface your most important task — so you spend zero time deciding.
              </p>

              {/* Highlighted task card */}
              <div className="bg-primary/10 border border-primary/25 rounded-2xl p-4 mb-3">
                <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-primary/60 mb-2">
                  Next best action
                </p>
                <p className="text-[15px] font-medium text-foreground mb-1">{createdTask.title}</p>
                <p className="text-[12px] text-muted-foreground">
                  {deadline === 'today' ? 'Due today · ' : ''}Highest priority
                </p>
              </div>

              {/* De-emphasised other tasks */}
              {['Review lecture notes', 'Reply to pending emails'].map((t) => (
                <div key={t} className="flex items-center gap-3 px-1 py-2.5 opacity-30">
                  <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" />
                  <span className="text-[13px] text-muted-foreground">{t}</span>
                </div>
              ))}

              <p className="text-[11px] text-muted-foreground/50 mt-4">
                Other tasks are visible but de-emphasised. No decision needed.
              </p>

              <div className="mt-auto pt-8">
                <button
                  onClick={handleMarkDone}
                  disabled={saving}
                  className="w-full py-4 rounded-2xl border border-border text-[15px] font-medium text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-40"
                >
                  {saving ? 'Marking done…' : 'Mark it done'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Screen 4: Habits intro ──────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22 }}
              className="flex flex-col flex-1 pt-8"
            >
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-5">
                Build consistency
              </p>
              <h1 className="text-[26px] font-medium text-foreground leading-snug mb-2">
                Habits keep you moving.
              </h1>
              <p className="text-[14px] text-muted-foreground leading-relaxed mb-6">
                Alongside tasks, Drivn lets you track daily habits. Tiny consistent actions compound into real results.
              </p>

              {/* Habit examples */}
              <div className="space-y-3 mb-6">
                {[
                  { emoji: '💪', name: 'Exercise', detail: 'Build physical momentum', color: 'text-primary' },
                  { emoji: '📖', name: 'Read 10 pages', detail: 'Feed your mind daily', color: 'text-amber-400' },
                  { emoji: '💧', name: 'Drink water', detail: 'Simple health wins', color: 'text-blue-400' },
                ].map(({ emoji, name, detail, color }) => (
                  <div
                    key={name}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card"
                  >
                    <span className="text-xl">{emoji}</span>
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-foreground">{name}</p>
                      <p className="text-[11px] text-muted-foreground/60">{detail}</p>
                    </div>
                    <div className={cn('w-5 h-5 rounded-full border-2 border-current flex items-center justify-center', color)}>
                      <Check className="w-3 h-3" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Feature highlights */}
              <div className="bg-secondary/60 rounded-2xl p-4 space-y-3">
                {[
                  { icon: Repeat, text: 'Track habits every day with a single tap' },
                  { icon: Zap, text: 'Log habits alongside tasks after focus sessions' },
                  { icon: Heart, text: 'Build streaks and see your consistency grow' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <Icon className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                    <span className="text-[13px] text-foreground/80">{text}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-8 space-y-3">
                <button
                  onClick={() => setStep(4)}
                  className="w-full py-4 rounded-2xl border border-border text-[15px] font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Got it
                </button>
                <button
                  onClick={() => { router.push('/habits') }}
                  className="w-full py-2 text-[13px] text-primary/70 hover:text-primary transition-colors"
                >
                  Set up habits now →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Screen 5: Notifications ─────────────────────────────── */}
          {step === 4 && (
            <motion.div
              key="step4-notifs"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22 }}
              className="flex flex-col flex-1 pt-8"
            >
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-5">
                Stay on track
              </p>
              <h1 className="text-[26px] font-medium text-foreground leading-snug mb-2">
                Get a daily nudge.
              </h1>
              <p className="text-[14px] text-muted-foreground leading-relaxed mb-8">
                Drivn can remind you once a day — right when you want to be reminded — so you never forget to get locked in.
              </p>

              <div className="bg-secondary/60 rounded-2xl p-5 flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-foreground">Daily reminder</p>
                  <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                    &ldquo;⚡ Time to get locked in&rdquo; — set the time in Profile later
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-4 space-y-3">
                {notifState === 'granted' ? (
                  <div className="w-full py-4 rounded-2xl bg-drivn-green/10 border border-drivn-green/25 text-center">
                    <p className="text-[15px] font-medium text-drivn-green">✓ Notifications enabled</p>
                  </div>
                ) : notifState === 'denied' ? (
                  <div className="w-full py-4 rounded-2xl bg-secondary border border-border text-center">
                    <p className="text-[13px] text-muted-foreground">You can enable these later in Profile → Notifications</p>
                  </div>
                ) : (
                  <button
                    onClick={handleEnableNotifs}
                    disabled={notifState === 'requesting'}
                    className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-[15px] font-medium transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {notifState === 'requesting' ? 'Enabling…' : 'Enable notifications'}
                  </button>
                )}
                <button
                  onClick={() => setStep(5)}
                  className="w-full py-2 text-[13px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Screen 6: Reinforcement ──────────────────────────────── */}
          {step === 5 && (
            <motion.div
              key="step4"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22 }}
              className="flex flex-col flex-1 pt-8"
            >
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-5">
                {createdTask ? 'First task complete' : 'You\'re all set'}
              </p>
              <h1 className="text-[26px] font-medium text-foreground leading-snug mb-8">
                {createdTask
                  ? 'You started. That\'s the hardest part.'
                  : 'Drivn is ready when you are.'}
              </h1>

              {createdTask ? (
                <>
                  {/* Check circle */}
                  <div className="w-14 h-14 rounded-full bg-drivn-green/15 border border-drivn-green/25 flex items-center justify-center mb-8">
                    <Check className="w-6 h-6 text-drivn-green" />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-6 w-full">
                    {[
                      { value: '1', label: 'Task completed' },
                      { value: '1', label: 'Day streak' },
                    ].map(({ value, label }) => (
                      <div key={label} className="bg-card border border-border rounded-2xl p-4 text-center">
                        <p className="text-[28px] font-medium text-foreground">{value}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* 7-day strip */}
                  <div className="flex gap-2 w-full">
                    {Array.from({ length: 7 }, (_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex-1 aspect-square rounded-lg flex items-center justify-center',
                          i === 0
                            ? 'bg-drivn-green/15 border border-drivn-green/30'
                            : 'bg-card border border-border'
                        )}
                      >
                        {i === 0 ? (
                          <Check className="w-3.5 h-3.5 text-drivn-green" />
                        ) : (
                          <span className="text-[11px] text-muted-foreground/25">{i + 1}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex justify-start">
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-primary" />
                  </div>
                </div>
              )}

              <div className="mt-auto pt-8">
                <button
                  onClick={handleFinish}
                  className="w-full py-4 rounded-2xl border border-border text-[15px] font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Go to my tasks
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}
