import Groq from 'groq-sdk'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import type { ScannedTask } from '@/types'

const ADMIN_EMAIL = 'vithusan.business@gmail.com'

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Resolve API key ───────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('anthropic_key_encrypted, beta_access, email')
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

  // ── Parse body ────────────────────────────────────────────────────────────
  const { imageBase64, mimeType } = (await req.json()) as {
    imageBase64: string
    mimeType: string
  }

  if (!imageBase64 || !mimeType) {
    return Response.json({ error: 'imageBase64 and mimeType required' }, { status: 400 })
  }

  // ── Call Groq vision ──────────────────────────────────────────────────────
  const groq = new Groq({ apiKey })
  const today = new Date().toISOString().split('T')[0]

  let text: string
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: `Extract every task, to-do item, or action from this image.

Today is ${today}. For each item extract:
- title: the task text (clean it up if handwriting is messy)
- due_date: YYYY-MM-DD format, or null. Parse "today", "tomorrow", "Friday", "next week", etc.
- due_time: HH:MM 24h format, or null. Parse "3pm"→"15:00", "9am"→"09:00", "noon"→"12:00", etc.
- estimated_minutes: number or null. Parse "30min"→30, "2h"→120, "quick"→15, "half hour"→30.
- urgency: "high" if marked !, urgent, ASAP, or starred. "low" if optional/someday. Otherwise "medium".

Respond with ONLY a valid JSON array — no markdown, no explanation:
[{"title":"...","due_date":null,"due_time":null,"estimated_minutes":null,"urgency":"medium"}]

If no tasks are found, return an empty array: []`,
            },
          ],
        },
      ],
      max_tokens: 1024,
    })
    text = (response.choices[0]?.message?.content ?? '').trim()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI API error'
    return Response.json({ error: msg }, { status: 500 })
  }

  // ── Strip markdown fences if present ─────────────────────────────────────
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  // ── Parse response ────────────────────────────────────────────────────────
  let tasks: ScannedTask[] = []
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      tasks = parsed
        .filter((t) => t && typeof t.title === 'string' && t.title.trim())
        .map((t) => ({
          title: String(t.title).trim(),
          due_date: t.due_date ?? null,
          due_time: t.due_time ?? null,
          estimated_minutes: typeof t.estimated_minutes === 'number' ? t.estimated_minutes : null,
          urgency: ['high', 'medium', 'low'].includes(t.urgency) ? t.urgency : 'medium',
        }))
    }
  } catch {
    tasks = []
  }

  return Response.json({ tasks })
}
