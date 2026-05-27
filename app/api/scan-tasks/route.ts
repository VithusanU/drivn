import Anthropic from '@anthropic-ai/sdk'
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
    // User's own key — always allowed
    try {
      apiKey = decrypt(profile.anthropic_key_encrypted)
    } catch {
      return Response.json({ error: 'Failed to decrypt API key' }, { status: 500 })
    }
  } else if (profile?.beta_access || profile?.email === ADMIN_EMAIL) {
    // Beta access — use server key
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'Server API key not configured' }, { status: 500 })
    }
    apiKey = process.env.ANTHROPIC_API_KEY
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

  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!validTypes.includes(mimeType)) {
    return Response.json({ error: 'Unsupported image type' }, { status: 400 })
  }

  // ── Call Claude vision ────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey })
  const today = new Date().toISOString().split('T')[0]

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
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
  })

  // ── Parse response ────────────────────────────────────────────────────────
  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'

  let tasks: ScannedTask[] = []
  try {
    const parsed = JSON.parse(text)
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
