/**
 * Natural language parser for voice task input.
 * Extracts title, due date, and urgency from a spoken phrase like
 * "cut grass sometime this week" or "call doctor urgently today".
 * No external API required — all client-side regex matching.
 */

import { addDays, addWeeks, endOfWeek, format } from 'date-fns'
import type { TaskUrgency } from '@/types'

export interface ParsedVoiceTask {
  title: string
  urgency: TaskUrgency
  dueDate: string | null
  dueTime: string | null
  estimatedMinutes: number | null
}

function toISO(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

// Index 0 = Sunday, 1 = Monday, … 6 = Saturday
const DAY_INDEX: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

function nextWeekday(dayIndex: number): Date {
  const today = new Date()
  let diff = dayIndex - today.getDay()
  if (diff <= 0) diff += 7 // always the *next* occurrence
  return addDays(today, diff)
}

function endOfThisWeek(): Date {
  // End of current Sun–Sat week (Sunday as week end)
  return endOfWeek(new Date(), { weekStartsOn: 1 })
}

function endOfNextWeek(): Date {
  return endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 })
}

// ── Due-date patterns (checked in order, first match wins) ──────────────────

interface DatePattern {
  regex: RegExp
  resolve: (match: RegExpMatchArray) => string
}

const DATE_PATTERNS: DatePattern[] = [
  { regex: /\btonight\b/i,                         resolve: () => toISO(new Date()) },
  { regex: /\btoday\b/i,                           resolve: () => toISO(new Date()) },
  { regex: /\btomorrow\b/i,                        resolve: () => toISO(addDays(new Date(), 1)) },
  { regex: /\bday\s+after\s+tomorrow\b/i,          resolve: () => toISO(addDays(new Date(), 2)) },
  { regex: /\bin\s+(\d+)\s+days?\b/i,              resolve: (m) => toISO(addDays(new Date(), parseInt(m[1]))) },
  { regex: /\bin\s+a\s+(?:couple|few)\s+days?\b/i, resolve: () => toISO(addDays(new Date(), 3)) },
  { regex: /\bin\s+a\s+week\b/i,                   resolve: () => toISO(addDays(new Date(), 7)) },
  { regex: /\bthis\s+week\b/i,                     resolve: () => toISO(endOfThisWeek()) },
  { regex: /\bnext\s+week\b/i,                     resolve: () => toISO(endOfNextWeek()) },
  // "by friday" / "next friday" / "on friday" / just "friday"
  ...Object.entries(DAY_INDEX).map(([name, idx]): DatePattern => ({
    regex: new RegExp(`\\b(?:by\\s+|next\\s+|on\\s+)?${name}\\b`, 'i'),
    resolve: () => toISO(nextWeekday(idx)),
  })),
]

// ── Urgency signals ──────────────────────────────────────────────────────────

const HIGH_URGENCY = /\b(urgent|urgently|asap|as soon as possible|immediately|critical|important|right away|now)\b/i
const LOW_URGENCY  = /\b(whenever|eventually|sometime|someday|no rush|not urgent|low priority|when you (can|get a chance)|at some point)\b/i

// ── Phrases to strip from title after extraction ─────────────────────────────

const STRIP_PATTERNS: RegExp[] = [
  // time phrases
  /\bsometime\s+this\s+week\b/gi,
  /\bthis\s+week\b/gi,
  /\bnext\s+week\b/gi,
  /\btonight\b/gi,
  /\btoday\b/gi,
  /\btomorrow\b/gi,
  /\bday\s+after\s+tomorrow\b/gi,
  /\bin\s+\d+\s+days?\b/gi,
  /\bin\s+a\s+(?:couple|few)\s+days?\b/gi,
  /\bin\s+a\s+week\b/gi,
  /\bby\s+\w+day\b/gi,        // "by friday"
  /\bon\s+\w+day\b/gi,        // "on monday"
  /\bnext\s+\w+day\b/gi,      // "next tuesday"
  /\b(?:sun|mon|tue|wed|thu|fri|sat)(?:urday|nesday|rsday|day)?\b/gi,
  // urgency words
  /\burgently?\b/gi,
  /\basap\b/gi,
  /\bas soon as possible\b/gi,
  /\bimmediately\b/gi,
  /\bimmediately\b/gi,
  /\bcritically?\b/gi,
  /\bimportant\b/gi,
  /\bright away\b/gi,
  /\bwhenever\b/gi,
  /\beventually\b/gi,
  /\bsometime\b/gi,
  /\bsomeday\b/gi,
  /\bno rush\b/gi,
  /\bnot urgent\b/gi,
  /\blow priority\b/gi,
  /\bwhen (you )?(can|get a chance)\b/gi,
  /\bat some point\b/gi,
  // common spoken filler
  /\bcan (i|you|we)\b/gi,
  /\bi need to\b/gi,
  /\bi (have|got) to\b/gi,
  /\bi (should|must|want to)\b/gi,
  /\bplease\b/gi,
  /\bremember to\b/gi,
  /\bdon'?t forget to?\b/gi,
  /\bmake sure to?\b/gi,
  /\badd\s+(a\s+)?task\s+(to\s+)?(|for\s+)/gi,
  /\bcreate\s+(a\s+)?task\s+(to\s+)?/gi,
]

// ── Time-of-day patterns ──────────────────────────────────────────────────────

function parseTimeOfDay(text: string): string | null {
  // "at noon" / "at midnight"
  if (/\b(?:at\s+)?noon\b/i.test(text)) return '12:00'
  if (/\b(?:at\s+)?midnight\b/i.test(text)) return '00:00'

  // "at 3pm", "by 2:30pm", "at 9 am", "at 10:15"
  const match = text.match(/\b(?:at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
  if (match) {
    let h = parseInt(match[1])
    const m = match[2] ? parseInt(match[2]) : 0
    const period = match[3]?.toLowerCase()
    if (period === 'pm' && h < 12) h += 12
    if (period === 'am' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  return null
}

const TIME_STRIP_PATTERNS: RegExp[] = [
  /\b(?:at|by)\s+noon\b/gi,
  /\b(?:at|by)\s+midnight\b/gi,
  /\b(?:at|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,
  /\b(?:at|by)\s+\d{1,2}(?::\d{2})?\b/gi,
]

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseVoiceInput(transcript: string): ParsedVoiceTask {
  const text = transcript.trim()

  // 1. Detect urgency
  let urgency: TaskUrgency = 'medium'
  if (HIGH_URGENCY.test(text)) urgency = 'high'
  else if (LOW_URGENCY.test(text)) urgency = 'low'

  // 2. Detect due date (first pattern to match wins)
  let dueDate: string | null = null
  for (const { regex, resolve } of DATE_PATTERNS) {
    const match = text.match(regex)
    if (match) {
      dueDate = resolve(match)
      break
    }
  }

  // 3. Detect due time ("at 3pm", "by 2:30", "at noon")
  const dueTime = parseTimeOfDay(text)

  // 4. Extract clean title by stripping date/time/urgency/filler phrases
  let title = text
  for (const pattern of [...TIME_STRIP_PATTERNS, ...STRIP_PATTERNS]) {
    title = title.replace(pattern, ' ')
  }
  title = title.replace(/\s+/g, ' ').trim()

  // Capitalise first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1)
  }

  return { title, urgency, dueDate, dueTime, estimatedMinutes: null }
}

// ── Browser support detection ─────────────────────────────────────────────────

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
}
