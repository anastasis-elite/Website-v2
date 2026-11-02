import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

type ReminderJob = { milestone_id: string; lease_token: string; user_id: string; email: string; first_attempt_at: string }
type ReminderMessage = { from: string; to: string; subject: string; html: string; text: string }
type ReminderSender = (message: ReminderMessage, options: { idempotencyKey: string }) => Promise<{ data?: { id?: string } | null; error?: unknown }>
type DeliveryOptions = { send?: ReminderSender; allowTest?: boolean; now?: () => Date }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const retryWindowMs = 23 * 3600_000
const testing = () => process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT)

function reminderLink(origin: string) {
  const base = new URL(origin)
  if (base.username || base.password || base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('Check-in reminder delivery is not configured.')
  return base.origin + '/dashboard/experience'
}

/** Only neutral, fixed copy enters email. Responses never enter this module. */
export function membershipReminderMessage(email: string, origin: string): ReminderMessage {
  const href = reminderLink(origin)
  return {
    from: 'Anastasis <onboarding@anastasiselite.com>', to: email,
    subject: 'Your Anastasis check-in',
    text: `A check-in is available in your Anastasis account. When it suits you, sign in to view it: ${href}`,
    html: `<p>A check-in is available in your Anastasis account.</p><p>When it suits you, sign in to view it.</p><p><a href="${href.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')}">Open your check-in</a></p>`,
  }
}

function senderConfigured(options: DeliveryOptions) {
  if (testing()) return options.allowTest === true && Boolean(options.send)
  return Boolean(options.send || process.env.RESEND_API_KEY)
}

/** A lease and an immutable milestone key protect against duplicate workers. */
export async function deliverMembershipReminder(supabase: SupabaseClient, milestoneId: string, origin: string, options: DeliveryOptions = {}): Promise<boolean> {
  if (!uuid.test(milestoneId)) throw new Error('A valid check-in reminder reference is required.')
  reminderLink(origin)
  if (!senderConfigured(options)) return false
  const claimed = await supabase.rpc('claim_membership_milestone_reminder', { p_milestone_id: milestoneId })
  if (claimed.error) throw new Error('Check-in reminder delivery could not be prepared.')
  if (!claimed.data) return false
  const lease = claimed.data as ReminderJob
  if (lease.milestone_id !== milestoneId || !uuid.test(lease.lease_token || '') || !uuid.test(lease.user_id || '')) throw new Error('Check-in reminder delivery could not be prepared.')
  let accepted = false
  try {
    let send = options.send
    if (!send) {
      const { Resend } = await import('resend')
      const provider = new Resend(process.env.RESEND_API_KEY)
      send = (payload, headers) => provider.emails.send(payload, headers)
    }
    // Re-read canonical owner, verified recipient, active recurring membership,
    // incomplete status and the provider retry window immediately before send.
    const checked = await supabase.rpc('recheck_membership_milestone_reminder', { p_milestone_id: milestoneId, p_lease_token: lease.lease_token })
    if (checked.error) throw new Error('Check-in reminder eligibility could not be confirmed.')
    if (!checked.data) return false
    const job = checked.data as ReminderJob
    const age = (options.now?.() || new Date()).getTime() - Date.parse(job.first_attempt_at)
    if (job.milestone_id !== milestoneId || job.lease_token !== lease.lease_token || job.user_id !== lease.user_id ||
      typeof job.email !== 'string' || job.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.email) ||
      !Number.isFinite(age) || age < 0 || age >= retryWindowMs) {
      await supabase.rpc('finish_membership_milestone_reminder', { p_milestone_id: milestoneId, p_lease_token: lease.lease_token, p_delivered: false })
      return false
    }
    const message = membershipReminderMessage(job.email, origin)
    const sent = await send(message, { idempotencyKey: `membership-milestone-reminder:${milestoneId}` })
    if (sent.error || !sent.data?.id) throw new Error('Check-in reminder delivery could not be confirmed.')
    accepted = true
    const finished = await supabase.rpc('finish_membership_milestone_reminder', { p_milestone_id: milestoneId, p_lease_token: lease.lease_token, p_delivered: true })
    if (finished.error || finished.data !== true) throw new Error('Check-in reminder status could not be confirmed.')
    return true
  } catch {
    // An uncertain accepted send stays leased; retry uses the same provider key.
    // SQL permanently suppresses completed/ineligible work and retires old jobs.
    if (!accepted) await supabase.rpc('finish_membership_milestone_reminder', { p_milestone_id: milestoneId, p_lease_token: lease.lease_token, p_delivered: false })
    throw new Error('Check-in reminder delivery could not be confirmed.')
  }
}

/** The existing daily worker materializes missed reminders even without a visit. */
export async function drainMembershipReminders(supabase: SupabaseClient, origin: string, options: DeliveryOptions = {}) {
  const refreshed = await supabase.rpc('refresh_membership_milestones', { p_limit: 50 })
  if (refreshed.error) throw new Error('Check-in reminder queue is unavailable.')
  if (!senderConfigured(options)) return { delivered: 0, failed: 0, skipped: 0, configured: false }
  const now = (options.now?.() || new Date()).toISOString()
  const due = await supabase.from('membership_milestone_reminders').select('milestone_id')
    .in('status', ['pending', 'leased']).lte('next_attempt_at', now)
    .or(`lease_expires_at.is.null,lease_expires_at.lt.${now}`).order('next_attempt_at').limit(10)
  if (due.error) throw new Error('Check-in reminder queue is unavailable.')
  let delivered = 0, failed = 0, skipped = 0
  for (const row of (due.data || []).slice(0, 10)) {
    try {
      if (await deliverMembershipReminder(supabase, row.milestone_id, origin, options)) delivered++
      else skipped++
    } catch { failed++ }
  }
  return { delivered, failed, skipped, configured: true }
}
