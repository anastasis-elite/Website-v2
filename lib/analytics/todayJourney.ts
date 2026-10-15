import { trackEvent } from '@/lib/analytics'

const ids = ['check-in', 'water', 'schedule', 'nutrition', 'workout', 'recovery']
type Journey = { date: string; opened: string[]; reported: string[] }
function read(storage: Storage, key: string, date: string): Journey {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    if (value?.date === date) return { date, opened: Array.isArray(value.opened) ? value.opened.filter((id: string) => ids.includes(id)) : [], reported: Array.isArray(value.reported) ? value.reported.filter((id: string) => ids.includes(id)) : [] }
  } catch { /* A damaged or restricted browser record never blocks the activity. */ }
  return { date, opened: [], reported: [] }
}

// Only fixed activity IDs and tier leave the browser. Answers and member IDs do not.
export function recordTodayActionOpened(clientId: string, date: string, activity: string, tier: string, alreadyCompleted = false) {
  const id = activity === 'food-input' ? 'nutrition' : ids.includes(activity) ? activity : 'schedule'
  trackEvent('next_action_opened', { activity: id, tier })
  if (alreadyCompleted) return
  try {
    const key = `anastasis:today-journey:${clientId}`, value = read(window.sessionStorage, key, date)
    value.opened = [...new Set([...value.opened, id])]
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch { /* Analytics continuity is optional. */ }
}

export function recordTodayActionCompletions(clientId: string, date: string, completed: string[], previous: string[] | null, tier: string) {
  let storage: Storage | undefined
  let value: Journey = { date, opened: [], reported: [] }
  const key = `anastasis:today-journey:${clientId}`
  try { storage = window.sessionStorage; value = read(storage, key, date) } catch { /* No browser storage. */ }
  for (const id of completed.filter(id => ids.includes(id))) {
    if (!value.reported.includes(id) && (value.opened.includes(id) || (previous !== null && !previous.includes(id)))) {
      trackEvent('next_action_completed', { activity: id, tier })
      value.reported.push(id)
    }
  }
  try { storage?.setItem(key, JSON.stringify(value)) } catch { /* Saving work never depends on analytics. */ }
}
