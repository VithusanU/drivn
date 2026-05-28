'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, X, Loader2, Trash2, ChevronDown, Check } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { cn } from '@/lib/utils'
import type { ScannedTask, TaskUrgency } from '@/types'

const URGENCY_OPTIONS: { value: TaskUrgency; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Med' },
  { value: 'low', label: 'Low' },
]

const URGENCY_ACTIVE: Record<TaskUrgency, string> = {
  high: 'bg-destructive/15 border-destructive/40 text-destructive',
  medium: 'bg-amber-400/10 border-amber-400/40 text-amber-400',
  low: 'bg-muted border-border text-muted-foreground',
}

const URGENCY_INACTIVE = 'border-border/40 text-muted-foreground/40 hover:border-border hover:text-muted-foreground/60'

type ScanState = 'idle' | 'scanning' | 'review'

interface EditableTask extends ScannedTask {
  _id: string // local id for React key
}

// ── Exported trigger ref so QuickCapture can open the scanner ──────────────
export interface TaskScannerRef {
  open: () => void
}

interface Props {
  scannerRef: React.MutableRefObject<TaskScannerRef | null>
}

export default function TaskScanner({ scannerRef }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createTask = useTaskStore((s) => s.createTask)

  const [scanState, setScanState] = useState<ScanState>('idle')
  const [tasks, setTasks] = useState<EditableTask[]>([])
  const [adding, setAdding] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Expose open() to parent via ref
  if (scannerRef) {
    scannerRef.current = {
      open: () => fileInputRef.current?.click(),
    }
  }

  // Resize image to max 1600px and compress to JPEG before sending
  const resizeImage = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX = 1600
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
          else { width = Math.round((width * MAX) / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
        resolve({ base64, mimeType: 'image/jpeg' })
      }
      img.onerror = reject
      img.src = url
    })

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be selected again
    e.target.value = ''

    setScanState('scanning')
    setErrorMsg(null)

    try {
      const { base64, mimeType: resizedMime } = await resizeImage(file)

      const res = await fetch('/api/scan-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: resizedMime }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to scan image')
      }

      const { tasks: scanned }: { tasks: ScannedTask[] } = await res.json()

      if (scanned.length === 0) {
        setErrorMsg('No tasks found in that image. Try a clearer photo.')
        setScanState('idle')
        return
      }

      setTasks(scanned.map((t, i) => ({ ...t, _id: `scan-${Date.now()}-${i}` })))
      setScanState('review')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setScanState('idle')
    }
  }

  const updateTask = (id: string, patch: Partial<ScannedTask>) => {
    setTasks((prev) => prev.map((t) => (t._id === id ? { ...t, ...patch } : t)))
  }

  const removeTask = (id: string) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t._id !== id)
      if (next.length === 0) setScanState('idle')
      return next
    })
  }

  const handleAddAll = async () => {
    setAdding(true)
    await Promise.all(
      tasks.map((t) =>
        createTask({
          title: t.title,
          urgency: t.urgency,
          due_date: t.due_date ?? null,
          due_time: t.due_time ?? null,
          estimated_minutes: t.estimated_minutes ?? null,
        })
      )
    )
    setAdding(false)
    setScanState('idle')
    setTasks([])
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <>
      {/* Hidden file input — accepts images, opens camera on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {/* Scanning overlay */}
      <AnimatePresence>
        {scanState === 'scanning' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-white/70">Reading your note…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-32 left-4 right-4 z-50 max-w-md mx-auto"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-destructive/15 border border-destructive/30">
              <p className="flex-1 text-sm text-destructive/80">{errorMsg}</p>
              <button onClick={() => setErrorMsg(null)} className="text-destructive/50 hover:text-destructive/80">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review sheet */}
      <AnimatePresence>
        {scanState === 'review' && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setScanState('idle')}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                'fixed bottom-0 left-0 right-0 z-50',
                'max-h-[85vh] flex flex-col',
                'bg-card rounded-t-3xl border-t border-border',
                'shadow-[0_-8px_40px_rgba(0,0,0,0.3)]'
              )}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-border/50">
                <div>
                  <h2 className="text-[15px] font-medium text-foreground">
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''} found
                  </h2>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    Review and edit before adding
                  </p>
                </div>
                <button
                  onClick={() => setScanState('idle')}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Task list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-2">
                {tasks.map((task) => (
                  <div
                    key={task._id}
                    className="rounded-2xl border border-border bg-background/50 p-4 space-y-3"
                  >
                    {/* Title */}
                    <div className="flex items-start gap-2">
                      <input
                        value={task.title}
                        onChange={(e) => updateTask(task._id, { title: e.target.value })}
                        className={cn(
                          'flex-1 bg-transparent border-none outline-none',
                          'text-[14px] font-medium text-foreground/90',
                          'placeholder:text-muted-foreground/30'
                        )}
                        placeholder="Task title"
                      />
                      <button
                        onClick={() => removeTask(task._id)}
                        className="p-1 text-muted-foreground/30 hover:text-destructive/60 transition-colors flex-shrink-0"
                        aria-label="Remove task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Urgency */}
                    <div className="flex gap-1.5">
                      {URGENCY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updateTask(task._id, { urgency: opt.value })}
                          className={cn(
                            'flex-1 py-1.5 rounded-xl border text-[11px] font-medium transition-all',
                            task.urgency === opt.value ? URGENCY_ACTIVE[opt.value] : URGENCY_INACTIVE
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Date + Time row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40">
                          Due date
                        </p>
                        <input
                          type="date"
                          value={task.due_date ?? ''}
                          min={todayStr}
                          onChange={(e) => updateTask(task._id, { due_date: e.target.value || null })}
                          className={cn(
                            'w-full px-2.5 py-2 rounded-xl border text-[11px] transition-all',
                            'bg-background text-foreground/70 outline-none',
                            task.due_date ? 'border-primary/40 text-primary' : 'border-border/40 text-muted-foreground/40',
                            '[color-scheme:dark]'
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40">
                          Due time
                        </p>
                        <input
                          type="time"
                          value={task.due_time ?? ''}
                          onChange={(e) => updateTask(task._id, { due_time: e.target.value || null })}
                          className={cn(
                            'w-full px-2.5 py-2 rounded-xl border text-[11px] transition-all',
                            'bg-background text-foreground/70 outline-none',
                            task.due_time ? 'border-primary/40 text-primary' : 'border-border/40 text-muted-foreground/40',
                            '[color-scheme:dark]'
                          )}
                        />
                      </div>
                    </div>

                    {/* Estimated minutes */}
                    <div className="flex items-center gap-2">
                      <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40 w-16 flex-shrink-0">
                        Est. time
                      </p>
                      <input
                        type="number"
                        min={5}
                        max={480}
                        step={5}
                        value={task.estimated_minutes ?? ''}
                        placeholder="mins"
                        onChange={(e) =>
                          updateTask(task._id, {
                            estimated_minutes: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className={cn(
                          'w-20 px-2.5 py-2 rounded-xl border text-[11px] transition-all',
                          'bg-background text-foreground/70 outline-none',
                          task.estimated_minutes ? 'border-primary/40 text-primary' : 'border-border/40 text-muted-foreground/40'
                        )}
                      />
                      {task.estimated_minutes && (
                        <span className="text-[11px] text-muted-foreground/40">
                          {task.estimated_minutes < 60
                            ? `${task.estimated_minutes}m`
                            : `${Math.floor(task.estimated_minutes / 60)}h${task.estimated_minutes % 60 ? ` ${task.estimated_minutes % 60}m` : ''}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-4 flex-shrink-0 border-t border-border/50 space-y-2">
                <button
                  onClick={handleAddAll}
                  disabled={adding || tasks.length === 0}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl',
                    'bg-primary text-primary-foreground text-[15px] font-medium',
                    'transition-all active:scale-[0.98] hover:bg-primary/90',
                    'disabled:opacity-50'
                  )}
                >
                  {adding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {adding ? 'Adding…' : `Add ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
                </button>
                <button
                  onClick={() => setScanState('idle')}
                  className="w-full py-2.5 rounded-2xl text-[13px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
