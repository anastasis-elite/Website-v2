export type ScheduleBlock = { days_of_week: number[]; start_time: string; end_time: string; active?: boolean }
function minutes(value: string) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }
function clock(value: number) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` }
export function getAvailableWindows(blocks: ScheduleBlock[], dayOfWeek: number, minimumMinutes = 10, transitionMinutes = 0) {
  const occupied: Array<[number, number]> = []
  for (const block of blocks) {
    if (block.active === false) continue
    const start = minutes(block.start_time), end = minutes(block.end_time)
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    if (block.days_of_week.includes(dayOfWeek)) occupied.push([Math.max(0, start - transitionMinutes), Math.min(1440, (end <= start ? 1440 : end) + transitionMinutes)])
    if (end <= start && block.days_of_week.includes((dayOfWeek + 6) % 7)) occupied.push([0, Math.min(1440, end + transitionMinutes)])
  }
  occupied.sort((a,b) => a[0]-b[0])
  const merged: Array<[number,number]> = []
  for (const [start,end] of occupied) { const last = merged.at(-1); if (last && start <= last[1]) last[1] = Math.max(last[1],end); else merged.push([start,end]) }
  const available: Array<{ start: string; end: string; minutes: number }> = []; let cursor = 0
  for (const [start,end] of merged) { if(start-cursor >= minimumMinutes) available.push({ start: clock(cursor), end: clock(start), minutes: start-cursor }); cursor = Math.max(cursor,end) }
  if (1440-cursor >= minimumMinutes) available.push({ start: clock(cursor),end:'24:00',minutes:1440-cursor })
  return available
}
