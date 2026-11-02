import type { RecoveryActivityDetails } from './activityDetails'

const additionLabels: Record<string, string> = { epsom_salts: 'Epsom salts', herbs: 'Herbs', tea: 'Teas', oats: 'Oats', other: 'Other', none: 'None' }

export function formatRecoveryDetails(details: RecoveryActivityDetails): string[] {
  const lines = [`${details.durationMinutes} minutes · Manual entry`]
  if (details.kind === 'slow_walk') {
    if (details.distance !== undefined && details.distanceUnit) {
      lines.push(`Distance: ${details.distance} ${details.distanceUnit}`)
      if (details.distance > 0 && details.durationMinutes > 0) lines.push(`Calculated pace: ${(details.durationMinutes / details.distance).toFixed(2)} min/${details.distanceUnit}`)
    }
    if (details.heartRateBpm !== undefined) lines.push(`Heart rate (manual): ${details.heartRateBpm} bpm`)
  } else {
    if (details.temperature !== undefined) lines.push(`Approximate temperature: ${details.temperature} °${details.temperatureUnit}`)
    if (details.additions?.length) lines.push(`Additions: ${details.additions.map(value => {
      const note = value === 'herbs' ? details.herbs : value === 'tea' ? details.tea : value === 'other' ? details.other : undefined
      return `${additionLabels[value] || value}${note ? ` (${note})` : ''}`
    }).join(', ')}`)
  }
  return lines
}
