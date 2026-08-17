export type ScheduleEventType =
  | 'workout'
  | 'meal'
  | 'hydration'
  | 'recovery'
  | 'check_in'
  | 'assessment'
  | 'work'
  | 'school'
  | 'appointment'
  | 'medical'
  | 'dental'
  | 'personal'
  | 'household'
  | 'sleep'
  | 'custom'

export type ScheduleEventSource =
  | 'manual'
  | 'anastasis'
  | 'program'
  | 'external_calendar'
  | 'mobile'
  | 'system'

export type ScheduleEventStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'skipped'
  | 'deferred'

export type ScheduleFlexibilityType =
  | 'fixed'
  | 'flexible'
  | 'approval_required'

export type SchedulePriority = 'low' | 'medium' | 'high' | 'critical'

export type ScheduleEvent = {
  id: string
  user_id: string
  client_id: string | null
  title: string
  description: string | null
  event_type: ScheduleEventType
  source: ScheduleEventSource
  start_at: string
  end_at: string
  timezone: string
  all_day: boolean
  status: ScheduleEventStatus
  completed_at: string | null
  flexibility_type: ScheduleFlexibilityType
  priority: SchedulePriority
  required: boolean
  movable: boolean
  approval_required: boolean
  earliest_start_at: string | null
  latest_end_at: string | null
  preferred_time: string | null
  estimated_duration_minutes: number | null
  external_provider_name: string | null
  external_contact_type: string | null
  external_contact_value: string | null
  external_event_id: string | null
  external_calendar_source: string | null
  reschedule_allowed: boolean
  reschedule_requires_approval: boolean
  last_reschedule_requested_at: string | null
  delegation_status: string | null
  delegation_notes: string | null
  adaptive_reason: string | null
  adjusted_start_at: string | null
  adjusted_end_at: string | null
  adjusted_duration_minutes: number | null
  created_at?: string
  updated_at?: string
  virtual?: boolean
  action_route?: string | null
}

export type OpenWindow = {
  start_at: string
  end_at: string
  minutes: number
}

export type ScheduleAdjustment = {
  event_id: string
  title: string
  adjustment_type: 'reduce_duration' | 'suggest_move' | 'suggest_recovery' | 'defer'
  reason: string
  suggested_start_at: string | null
  suggested_end_at: string | null
  suggested_duration_minutes: number | null
  requires_approval: boolean
  automatic: boolean
  applied: boolean
}

export type NextScheduleAction = {
  id: string
  title: string
  category: ScheduleEventType
  start_at: string | null
  urgency: 'now' | 'soon' | 'upcoming' | 'overdue' | 'none'
  reason: string
  action_route: string | null
  overdue: boolean
  automatically_adjusted: boolean
  can_complete: boolean
  can_defer: boolean
  short_reason: string
}

export type DailyScheduleState = {
  date: string
  timezone: string
  now: string
  events: ScheduleEvent[]
  completedEvents: ScheduleEvent[]
  upcomingEvents: ScheduleEvent[]
  overdueEvents: ScheduleEvent[]
  fixedEvents: ScheduleEvent[]
  flexibleEvents: ScheduleEvent[]
  approvalRequiredEvents: ScheduleEvent[]
  openWindows: OpenWindow[]
  adjustments: ScheduleAdjustment[]
  nextEvent: ScheduleEvent | null
  nextActionableEvent: ScheduleEvent | null
  nextAction: NextScheduleAction
}
