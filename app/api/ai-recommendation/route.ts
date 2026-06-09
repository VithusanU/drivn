import Groq from 'groq-sdk'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import type { Task } from '@/types'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vithusan.business@gmail.com'

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
  const { tasks, force, context } = (await req.json()) as {
    tasks: Task[]
    force?: boolean
    context?: string
  }

  // ── Supabase cache check (replaces broken in-memory Map) ───────────────────
  // If context is provided, treat as forced refresh — the day's constraints changed
  if (!force && !context) {
    const { data: cached } = await supabase
      .from('ai_recommendation_cache')
      .select('json, expires_at')
      .eq('user_id', user.id)
      .single()

    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(cached.json, {
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const activeTasks = tasks.filter((t) => t.status === 'active')
  if (activeTasks.length === 0) {
    return Response.json({ taskId: null, reason: '', quickWinIds: [] })
  }

  // ── Build prompt ────────────────────────────────────────────────────────────
  const now = new Date()
  const timeContext = now.toLocaleString('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const taskList = activeTasks.map((t) => ({
    id: t.id,
    title: t.title,
    urgency: t.urgency,
    due_date: t.due_date,
    due_time: t.due_time,
    estimated_minutes: t.estimated_minutes,
    blocked_by: t.blocked_by,
    is_hard_deadline: t.is_hard_deadline,
    created_at: t.created_at,
  }))

  const prompt = `You are the priority engine for drivn, a focus and productivity app.
Given a list of tasks, identify the single best one to work on RIGHT NOW plus up to 3 quick wins.

Hard rules:
- NEVER recommend a task whose blocked_by field matches another task's id in the list
- Tasks with is_hard_deadline=true that are due today or overdue are the absolute top priority — they have no flexibility
- Overdue tasks with high urgency take top priority after hard deadlines
- Quick wins must have estimated_minutes <= 30, must not be blocked, and must not be the main recommendation

Soft rules:
- Read task titles semantically — a bug fix affecting users outweighs a cosmetic change even with equal metadata
- Consider downstream impact: completing a blocker that unblocks 2+ tasks is often best
- Factor in time of day and day of week for energy-matching
- When user context is provided, honour those constraints above soft rules (e.g. if they say "low energy", prefer shorter tasks; if they mention a meeting at 3pm, don't recommend a 2h task at 2pm)

Respond with ONLY valid JSON — no markdown, no explanation:
{"taskId":"<id or null>","reason":"<max 12 words>","quickWinIds":["<id>"]}

Current time: ${timeContext}
${context ? `\nUser's context for today: ${context}\n` : ''}
Tasks:
${JSON.stringify(taskList, null, 2)}

What should I do right now?`

  // ── Call Groq ───────────────────────────────────────────────────────────────
  const groq = new Groq({ apiKey })

  let text: string
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
    })
    text = (response.choices[0]?.message?.content ?? '').trim()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI API error'
    return Response.json({ error: msg }, { status: 500 })
  }

  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  // ── Parse response ──────────────────────────────────────────────────────────
  let result: { taskId: string | null; reason: string; quickWinIds: string[] }
  try {
    result = JSON.parse(cleaned)
    if (result.taskId && !activeTasks.find((t) => t.id === result.taskId)) {
      result.taskId = null
    }
    result.quickWinIds = (result.quickWinIds ?? []).filter((id) =>
      activeTasks.find((t) => t.id === id)
    )
  } catch {
    result = { taskId: null, reason: '', quickWinIds: [] }
  }

  // ── Cache in Supabase for 60 seconds ────────────────────────────────────────
  const json = JSON.stringify(result)
  const expiresAt = new Date(Date.now() + 60_000).toISOString()
  await supabase
    .from('ai_recommendation_cache')
    .upsert(
      { user_id: user.id, json, expires_at: expiresAt, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  return new Response(json, { headers: { 'Content-Type': 'application/json' } })
}
