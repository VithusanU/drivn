import { createClient } from '@/lib/supabase/server'
import { encrypt, maskKey } from '@/lib/encryption'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { key } = (await req.json()) as { key: string }

  if (!key || !key.startsWith('sk-or-')) {
    return Response.json({ error: 'Invalid key format — must be an OpenRouter API key starting with sk-or-' }, { status: 400 })
  }

  let encrypted: string
  try {
    encrypted = encrypt(key)
  } catch {
    return Response.json({ error: 'Encryption failed' }, { status: 500 })
  }

  const masked = maskKey(key)

  const { error } = await supabase
    .from('user_profiles')
    .update({ anthropic_key_encrypted: encrypted, anthropic_key_masked: masked })
    .eq('id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ masked })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('user_profiles')
    .update({ anthropic_key_encrypted: null, anthropic_key_masked: null })
    .eq('id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
