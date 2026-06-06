'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Check, Copy, Link2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'email' | 'username' | 'invite'

interface SearchResult {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onRequestSent?: () => void
}

export default function AddFriendSheet({ open, onClose, onRequestSent }: Props) {
  const [tab, setTab] = useState<Tab>('email')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSearch = async () => {
    const q = query.trim()
    if (!q || q.length < 2) return
    setSearching(true)
    setSearched(false)
    try {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setResults(json.results ?? [])
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  const handleSendRequest = async (userId: string) => {
    if (sentIds.has(userId)) return
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresseeId: userId }),
    })
    if (res.ok || res.status === 409) {
      setSentIds((prev) => new Set(prev).add(userId))
      onRequestSent?.()
    }
  }

  const handleGenerateInvite = async () => {
    setInviteLoading(true)
    try {
      const res = await fetch('/api/friends/invite')
      const json = await res.json()
      setInviteUrl(json.url ?? null)
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'email', label: 'Email' },
    { id: 'username', label: 'Username' },
    { id: 'invite', label: 'Invite link' },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] flex flex-col bg-card rounded-t-3xl border-t border-border shadow-[0_-8px_40px_rgba(0,0,0,0.3)]"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-border/50">
              <h2 className="text-[15px] font-medium text-foreground">Add a friend</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-secondary">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTab(t.id); setQuery(''); setResults([]); setSearched(false) }}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all',
                      tab === t.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground/60 hover:text-muted-foreground'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Email / Username search tabs */}
              {(tab === 'email' || tab === 'username') && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setSearched(false) }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder={tab === 'email' ? 'friend@example.com' : '@username'}
                      className={cn(
                        'flex-1 px-3.5 py-2.5 rounded-xl border text-[14px] bg-background',
                        'text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors',
                        query ? 'border-primary/40' : 'border-border'
                      )}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching || query.trim().length < 2}
                      className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium disabled:opacity-50 transition-opacity flex items-center gap-1.5"
                    >
                      {searching
                        ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        : <Search className="w-4 h-4" />
                      }
                    </button>
                  </div>

                  {/* Results */}
                  {searched && results.length === 0 && (
                    <p className="text-[13px] text-muted-foreground/50 text-center py-4">
                      No user found — double-check and try again
                    </p>
                  )}
                  {results.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border bg-background"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[12px] font-bold flex-shrink-0">
                        {(r.full_name || r.username || '?')[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">
                          {r.full_name || r.username || 'Unknown'}
                        </p>
                        {r.username && (
                          <p className="text-[11px] text-muted-foreground/50">@{r.username}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleSendRequest(r.id)}
                        className={cn(
                          'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all',
                          sentIds.has(r.id)
                            ? 'bg-drivn-green/10 border border-drivn-green/30 text-drivn-green'
                            : 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
                        )}
                      >
                        {sentIds.has(r.id) ? <Check className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                        {sentIds.has(r.id) ? 'Sent' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Invite link tab */}
              {tab === 'invite' && (
                <div className="space-y-3">
                  <p className="text-[13px] text-muted-foreground/70">
                    Share your invite link — anyone who opens it will be added as your friend instantly.
                  </p>

                  {!inviteUrl ? (
                    <button
                      onClick={handleGenerateInvite}
                      disabled={inviteLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-medium disabled:opacity-60 transition-all"
                    >
                      {inviteLoading
                        ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        : <Link2 className="w-4 h-4" />
                      }
                      Generate invite link
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-secondary">
                        <p className="flex-1 text-[12px] text-muted-foreground truncate">{inviteUrl}</p>
                        <button
                          onClick={handleCopy}
                          className={cn(
                            'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all',
                            copied
                              ? 'text-drivn-green'
                              : 'text-primary hover:text-primary/80'
                          )}
                        >
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <button
                        onClick={handleGenerateInvite}
                        className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
                      >
                        Generate new link
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
