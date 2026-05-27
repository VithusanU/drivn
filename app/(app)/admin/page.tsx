'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Clock, XCircle, Copy, Check, Users, TrendingUp, Target, ExternalLink, Sparkles } from 'lucide-react'
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

interface BetaRequest {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  status: 'pending' | 'approved' | 'denied'
  requested_at: string
  reviewed_at: string | null
}

interface Metrics {
  totalUsers: number
  signupsThisWeek: number
  tasksCreated: number
  tasksCompleted: number
  completionRate: number
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [requests, setRequests] = useState<SpotifyRequest[]>([])
  const [betaRequests, setBetaRequests] = useState<BetaRequest[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [updatingBeta, setUpdatingBeta] = useState<string | null>(null)

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
    await Promise.all([fetchRequests(), fetchMetrics(), fetchBetaRequests()])
    setLoading(false)
  }

  const fetchMetrics = async () => {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('get_admin_metrics')
    if (error || !data) return

    const tasksCreated = data.tasksCreated ?? 0
    const tasksCompleted = data.tasksCompleted ?? 0
    const total = tasksCreated + tasksCompleted
    const rate = total > 0 ? Math.round((tasksCompleted / total) * 100) : 0

    setMetrics({
      totalUsers: data.totalUsers ?? 0,
      signupsThisWeek: data.signupsThisWeek ?? 0,
      tasksCreated,
      tasksCompleted,
      completionRate: rate,
    })
  }

  const fetchRequests = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('spotify_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setRequests((data as SpotifyRequest[]) ?? [])
  }

  const fetchBetaRequests = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('beta_requests')
      .select('*')
      .order('requested_at', { ascending: false })
    setBetaRequests((data as BetaRequest[]) ?? [])
  }

  const updateStatus = async (id: string, status: 'approved' | 'denied') => {
    setUpdating(id)
    const supabase = createClient()
    await supabase.from('spotify_requests').update({ status }).eq('id', id)
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    setUpdating(null)
  }

  const updateBetaStatus = async (request: BetaRequest, status: 'approved' | 'denied') => {
    setUpdatingBeta(request.id)
    const supabase = createClient()
    const now = new Date().toISOString()

    // Update beta_requests row
    await supabase
      .from('beta_requests')
      .update({ status, reviewed_at: now })
      .eq('id', request.id)

    // If approved, grant beta_access on user_profiles
    if (status === 'approved') {
      await supabase
        .from('user_profiles')
        .update({ beta_access: true })
        .eq('id', request.user_id)
    } else {
      // If denied, revoke (in case re-reviewed)
      await supabase
        .from('user_profiles')
        .update({ beta_access: false })
        .eq('id', request.user_id)
    }

    setBetaRequests((prev) =>
      prev.map((r) => (r.id === request.id ? { ...r, status, reviewed_at: now } : r))
    )
    setUpdatingBeta(null)
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
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview and access management</p>
      </div>

      {/* ── Metrics ── */}
      {metrics && (
        <div className="space-y-4">
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Growth</p>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard icon={Users} label="Total users" value={metrics.totalUsers} />
            <MetricCard icon={TrendingUp} label="Signups this week" value={metrics.signupsThisWeek} />
          </div>

          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground pt-2">Product</p>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard icon={Target} label="Tasks created" value={metrics.tasksCreated} />
            <MetricCard icon={CheckCircle} label="Tasks completed" value={metrics.tasksCompleted} />
            <MetricCard icon={TrendingUp} label="Completion rate" value={`${metrics.completionRate}%`} />
          </div>

          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground pt-2">Analytics & Errors</p>
          <div className="grid grid-cols-2 gap-3">
            <a
              href="https://us.posthog.com/project/430193"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] text-muted-foreground">PostHog</p>
                <p className="text-[13px] font-medium text-foreground">Events & funnels</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40" />
            </a>
            <a
              href="https://drivn.sentry.io"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] text-muted-foreground">Sentry</p>
                <p className="text-[13px] font-medium text-foreground">Errors & crashes</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40" />
            </a>
          </div>
        </div>
      )}

      {/* ── Spotify Requests ── */}
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Spotify Access Requests</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            Approve → add email to{' '}
            <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Spotify Dashboard
            </a>
            {' '}→ user can connect.
          </p>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <div className="space-y-4">
            {pending.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground/60">Pending ({pending.length})</p>
                {pending.map((r) => (
                  <RequestRow key={r.id} request={r} copied={copied} updating={updating} onCopy={copyEmail} onApprove={() => updateStatus(r.id, 'approved')} onDeny={() => updateStatus(r.id, 'denied')} />
                ))}
              </div>
            )}
            {rest.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground/60">Reviewed</p>
                {rest.map((r) => (
                  <RequestRow key={r.id} request={r} copied={copied} updating={updating} onCopy={copyEmail} onApprove={() => updateStatus(r.id, 'approved')} onDeny={() => updateStatus(r.id, 'denied')} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Beta Access Requests ── */}
      {(() => {
        const betaPending = betaRequests.filter((r) => r.status === 'pending')
        const betaReviewed = betaRequests.filter((r) => r.status !== 'pending')
        return (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">Beta Access Requests</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                Approve to grant AI mode access. Deny to reject.
              </p>
            </div>

            {betaRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            ) : (
              <div className="space-y-4">
                {betaPending.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground/60">Pending ({betaPending.length})</p>
                    {betaPending.map((r) => (
                      <BetaRequestRow
                        key={r.id}
                        request={r}
                        updating={updatingBeta}
                        onApprove={() => updateBetaStatus(r, 'approved')}
                        onDeny={() => updateBetaStatus(r, 'denied')}
                      />
                    ))}
                  </div>
                )}
                {betaReviewed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground/60">Reviewed</p>
                    {betaReviewed.map((r) => (
                      <BetaRequestRow
                        key={r.id}
                        request={r}
                        updating={updatingBeta}
                        onApprove={() => updateBetaStatus(r, 'approved')}
                        onDeny={() => updateBetaStatus(r, 'denied')}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground/50" />
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function RequestRow({ request, copied, updating, onCopy, onApprove, onDeny }: {
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
        <p className="text-[13px] font-medium text-foreground truncate">{request.user_name || request.user_email}</p>
        <p className="text-[11px] text-muted-foreground/60 truncate">{request.user_email}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[11px] text-muted-foreground">Spotify:</span>
          <span className="text-[11px] text-foreground font-mono">{request.spotify_email}</span>
          <button onClick={() => onCopy(request.spotify_email)} className="text-muted-foreground/40 hover:text-foreground transition-colors">
            {wasCopied ? <Check className="w-3 h-3 text-[#1DB954]" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {request.status === 'pending' ? (
          <>
            <button onClick={onDeny} disabled={isUpdating} className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
              <XCircle className="w-4 h-4" />
            </button>
            <button onClick={onApprove} disabled={isUpdating} className="px-3 py-1.5 rounded-lg bg-[#1DB954]/10 border border-[#1DB954]/30 text-[#1DB954] text-[12px] font-medium hover:bg-[#1DB954]/20 transition-colors disabled:opacity-50">
              {isUpdating ? '…' : 'Approve'}
            </button>
          </>
        ) : (
          <div className={cn('flex items-center gap-1 text-[11px] font-medium', request.status === 'approved' ? 'text-[#1DB954]' : 'text-muted-foreground/50')}>
            {request.status === 'approved' ? <><CheckCircle className="w-3.5 h-3.5" /> Approved</> : <><XCircle className="w-3.5 h-3.5" /> Denied</>}
          </div>
        )}
      </div>
    </div>
  )
}

function BetaRequestRow({ request, updating, onApprove, onDeny }: {
  request: BetaRequest
  updating: string | null
  onApprove: () => void
  onDeny: () => void
}) {
  const isUpdating = updating === request.id

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="w-3.5 h-3.5 text-primary/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">
          {request.user_name || request.user_email}
        </p>
        <p className="text-[11px] text-muted-foreground/60 truncate">{request.user_email}</p>
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
              className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {isUpdating ? '…' : 'Approve'}
            </button>
          </>
        ) : (
          <div className={cn(
            'flex items-center gap-1 text-[11px] font-medium',
            request.status === 'approved' ? 'text-primary' : 'text-muted-foreground/50'
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
