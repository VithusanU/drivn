// Returns true if a recurring (or one-time) event should appear on the given date.
// Uses local-time Date constructors to avoid UTC midnight timezone shifts.
export function eventFallsOnDate(
  event: { event_date: string; recurrence: string; recurrence_days: number | null },
  dateStr: string
): boolean {
  if (event.recurrence === 'none') return event.event_date === dateStr
  if (dateStr < event.event_date) return false
  if (event.event_date === dateStr) return true
  const [by, bm, bd] = event.event_date.split('-').map(Number)
  const [ty, tm, td] = dateStr.split('-').map(Number)
  const base = new Date(by, bm - 1, bd)
  const target = new Date(ty, tm - 1, td)
  // Math.round handles ±1h DST offset that would otherwise throw off diffDays by 1
  const diffDays = Math.round((target.getTime() - base.getTime()) / 86400000)
  if (event.recurrence === 'weekly') return diffDays % 7 === 0
  if (event.recurrence === 'custom' && event.recurrence_days) return diffDays % event.recurrence_days === 0
  if (event.recurrence === 'monthly') {
    if (base.getDate() !== target.getDate()) return false
    const check = new Date(base)
    while (check < target) check.setMonth(check.getMonth() + 1)
    return check.getTime() === target.getTime()
  }
  return false
}
