'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Clock, XCircle, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const ADMIN_EMAIL = 'vithusan.business@gmail.com'

interface SpotifyRequest {
  id: string
  user_email: string
  user_name: string
  spotify_email: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [requests, setRequests] = useState<SpotifyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) {
      setAuthorized(false)
      setLoading(false)
      return
    }
    setAuthorized(true)
    fetchRequests()
  }

  const fetchRequests = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('spotify_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setRequests((data as SpotifyRequest[]) ?? [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: 'approved' | 'denied') => {
    setUpdating(id)
    const supabase = createClient()
    await supabase
      .from('spotify_requests')
      .update({ status })
      .eq('id', id)
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    )
    setUpdating(null)
  }

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email)
    setCopied(email)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Not authorized.</p>
      </div>
    )
  }

  const pending = requests.filter((r) => r.status === 'pending')
  const rest = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-foreground mb-1">Spotify Access Requests</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Approve a request → add their Spotify email to your{' '}
        <a
          href="https://developer.spotify.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Spotify Developer Dashboard
        </a>{' '}
        → they can connect.
      </p>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests yet.</p>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
                Pending ({pending.length})
              </p>
              <div className="space-y-2">
                {pending.map((r) => (
                  <RequestRow
                    key={r.id}
                    request={r}
                    copied={copied}
                    updating={updating}
                    onCopy={copyEmail}
                    onApprove={() => updateStatus(r.id, 'approved')}
                    onDeny={() => updateStatus(r.id, 'denied')}
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
                Reviewed
              </p>
              <div className="space-y-2">
                {rest.map((r) => (
                  <RequestRow
                    key={r.id}
                    request={r}
                    copied={copied}
                    updating={updating}
                    onCopy={copyEmail}
                    onApprove={() => updateStatus(r.id, 'approved')}
                    onDeny={() => updateStatus(r.id, 'denied')}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function RequestRow({
  request, copied, updating, onCopy, onApprove, onDeny,
}: {
  request: SpotifyRequest
  copied: string | null
  updating: string | null
  onCopy: (email: string) => void
  onApprove: () => void
  onDeny: () => void
}) {
  const isUpdating = updating === request.id
  const wasCopied = copied === request.spotify_email

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">
          {request.user_name || request.user_email}
        </p>
        <p className="text-[11px] text-muted-foreground/60 truncate">{request.user_email}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[11px] text-muted-foreground">Spotify:</span>
          <span className="text-[11px] text-foreground font-mono">{request.spotify_email}</span>
          <button
            onClick={() => onCopy(request.spotify_email)}
            className="text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            {wasCopied ? <Check className="w-3 h-3 text-[#1DB954]" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {request.status === 'pending' ? (
          <>
            <button
              onClick={onDeny}
              disabled={isUpdating}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
            </button>
            <button
              onClick={onApprove}
              disabled={isUpdating}
              className="px-3 py-1.5 rounded-lg bg-[#1DB954]/10 border border-[#1DB954]/30 text-[#1DB954] text-[12px] font-medium hover:bg-[#1DB954]/20 transition-colors disabled:opacity-50"
            >
              {isUpdating ? '…' : 'Approve'}
            </button>
          </>
        ) : (
          <div className={cn(
            'flex items-center gap-1 text-[11px] font-medium',
            request.status === 'approved' ? 'text-[#1DB954]' : 'text-muted-foreground/50'
          )}>
            {request.status === 'approved'
              ? <><CheckCircle className="w-3.5 h-3.5" /> Approved</>
              : <><XCircle className="w-3.5 h-3.5" /> Denied</>
            }
          </div>
        )}
      </div>
    </div>
  )
}
