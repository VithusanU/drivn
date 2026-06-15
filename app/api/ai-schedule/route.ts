import Groq from 'groq-sdk'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import type { Task, CalendarEvent, ScheduleBlock } from '@/types'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vithusan.business@gmail.com'

// Add minutes to an "HH:MM" time string, clamped to the same day (23:59 max).
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59)
  const eh = Math.floor(total / 60)
  const em = total % 60
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
}

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Resolve API key ─────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('beta_access, email, anthropic_key_encrypted')
    .eq('id', user.id)
    .single()

  let apiKey: string

  if (profile?.anthropic_key_encrypted) {
    try {
      apiKey = decrypt(profile.anthropic_key_encrypted)
    } catch {
      return Response.json({ error: 'Failed to decrypt API key' }, { status: 500 })
    }
  } else if (profile?.beta_access || profile?.email === ADMIN_EMAIL) {
    if (!process.env.GROQ_API_KEY) {
      return Response.json({ error: 'Server API key not configured' }, { status: 500 })
    }
    apiKey = process.env.GROQ_API_KEY
  } else {
    return Response.json({ error: 'Beta access or own API key required' }, { status: 403 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { tasks, events, now, workEndTime, context } = (await req.json()) as {
    tasks: Task[]
    events: CalendarEvent[]
    now: string          // "HH:MM" local time, current moment
    workEndTime: string  // "HH:MM" local time, when the user wants to be done
    context?: string
  }

  const activeTasks = tasks.filter((t) => t.status === 'active')

  if (activeTasks.length === 0 && events.length === 0) {
    return Response.json({ blocks: [], notes: ['Nothing to schedule today.'] })
  }

  // ── Build prompt ────────────────────────────────────────────────────────────
  const taskList = activeTasks.map((t) => ({
    id: t.id,
    title: t.title,
    urgency: t.urgency,
    due_date: t.due_date,
    due_time: t.due_time,
    estimated_minutes: t.estimated_minutes,
    blocked_by: t.blocked_by,
    is_hard_deadline: t.is_hard_deadline,
  }))

  const eventList = events.map((e) => ({
    id: e.id,
    title: e.title,
    event_time: e.event_time,
    category: e.category,
  }))

  const prompt = `You are the day-planning engine for drivn, a focus and productivity app.
Build a realistic schedule for the REST of today, starting at ${now} and ending by ${workEndTime} (the user's "finish work by" time).

Fixed calendar events (already scheduled, cannot move, never overlap these):
${JSON.stringify(eventList, null, 2)}

Active tasks available to slot in (not all need to be scheduled):
${JSON.stringify(taskList, null, 2)}

Hard rules:
- Events are immovable blocks — place tasks around them, never overlapping
- A task with is_hard_deadline=true that is due today MUST be scheduled before its due_time, even if that pushes the schedule past ${workEndTime} — if this happens, add a note explaining why
- Use each task's estimated_minutes for its block length (default 30 minutes if missing)
- Only include tasks that reasonably fit between ${now} and ${workEndTime} — prioritize overdue tasks, then high urgency, then due-soon tasks
- Do not invent tasks or events that weren't provided
- If there is leftover time between blocks, add a "free" block for it (id: null)
- Times must be "HH:MM" 24-hour format, start <= end, and blocks must be in chronological order without overlaps

${context ? `User's context for today: ${context}
If this context mentions something happening at a specific time (e.g. "convocation 12:30 till 4pm", "meeting at 3pm"), treat it as a fixed "event" block exactly like the calendar events above — immovable, and schedule tasks around it. Give it a sensible title and id: null.
` : ''}
Respond with ONLY valid JSON — no markdown, no explanation:
{"blocks":[{"start":"HH:MM","end":"HH:MM","type":"event|task|free","title":"<short title>","id":"<task or event id, or null for free>"}],"notes":["<short note, max 2 sentences>"]}

Keep "notes" to at most 3 items, only for important callouts (e.g. a hard deadline pushed past finish time, or tasks that didn't fit).`

  // ── Call Groq ───────────────────────────────────────────────────────────────
  const groq = new Groq({ apiKey })

  let text: string
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    })
    text = (response.choices[0]?.message?.content ?? '').trim()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI API error'
    return Response.json({ error: msg }, { status: 500 })
  }

  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  // ── Parse + validate response ─────────────────────────────────────────────────
  const validIds = new Set([...activeTasks.map((t) => t.id), ...events.map((e) => e.id)])
  let result: { blocks: ScheduleBlock[]; notes: string[] }
  try {
    const parsed = JSON.parse(cleaned)
    const blocks: ScheduleBlock[] = (Array.isArray(parsed.blocks) ? parsed.blocks : [])
      .filter((b: any) =>
        b &&
        typeof b.start === 'string' &&
        typeof b.end === 'string' &&
        typeof b.title === 'string' &&
        ['event', 'task', 'free'].includes(b.type)
      )
      .map((b: any) => ({
        start: b.start,
        end: b.end,
        type: b.type,
        title: b.title,
        id: b.id && validIds.has(b.id) ? b.id : null,
      }))
      // For task blocks, trust the user's own time estimate over the model's
      // arithmetic — recompute `end` from estimated_minutes so the allocated
      // time always matches what was set on the task.
      .map((b: ScheduleBlock) => {
        if (b.type !== 'task' || !b.id) return b
        const task = activeTasks.find((t) => t.id === b.id)
        if (!task?.estimated_minutes) return b
        return { ...b, end: addMinutes(b.start, task.estimated_minutes) }
      })
      .sort((a: ScheduleBlock, b: ScheduleBlock) => a.start.localeCompare(b.start))

    const notes = Array.isArray(parsed.notes)
      ? parsed.notes.filter((n: unknown) => typeof n === 'string').slice(0, 3)
      : []

    result = { blocks, notes }
  } catch {
    result = { blocks: [], notes: ['Could not generate a schedule right now. Try again.'] }
  }

  return Response.json(result)
}
