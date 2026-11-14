'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TodayBootstrap } from '@/lib/dashboard/todayBootstrap'
import type { TodayEnrichment } from '@/lib/dashboard/loadTodayEnrichment'
import { canRetainTodayStartup, matchesTodayStartup, todayStartupKey } from '@/lib/dashboard/todayStartupState'
import { beginTodayStartup } from '@/lib/performance/dashboard'
import type { DashboardTimingEntry } from '@/lib/performance/dashboardTimingTypes'
import { createClient } from '@/lib/supabase/client'
import { addLocalDays, localDateKey } from '@/lib/timezone'
import { zonedDateTimeToUtc } from '@/lib/schedule/time'
import { useDailyScheduleRefresh } from '@/lib/schedule/client'
import { recordTodayActionOpened } from '@/lib/analytics/todayJourney'
import TodayDashboardHeader from './TodayDashboardHeader'
import TodayDayCarousel from './TodayDayCarousel'
import TodayInstallButton from '@/components/pwa/TodayInstallButton'
import DashboardPerformance from '@/components/DashboardPerformance'
import DeferredTodayGuidance from './DeferredTodayGuidance'
import styles from './TodayPlanTheme.module.css'


function useTodayResource<T extends TodayBootstrap | TodayEnrichment>(kind: 'bootstrap' | 'enrichment', seed: TodayBootstrap, revision: number, disabled: boolean) {
  const router = useRouter()
  const key = todayStartupKey(seed)
  const [retryState, setRetry] = useState({ key, count: 0 })
  const retry = retryState.key === key ? retryState.count : 0
  const initialBootstrap = kind === 'bootstrap' && revision === 0 && retry === 0 && seed.checkIn.status !== 'pending' ? seed as T : undefined
  const [state, setState] = useState<{ key: string; revision: number; data?: T; error?: string; blocked?: boolean; settled?: boolean }>({ key, revision, data: initialBootstrap, settled: Boolean(initialBootstrap) })
  const generation = useRef(0)
  useEffect(() => {
    const current = ++generation.current
    if (disabled) return
    // A verified server seed already includes the small owner-bound read. Do
    // not repeat auth/access/safety and check-in over HTTP after hydration.
    if (initialBootstrap) {
      setState({ key, revision, data: initialBootstrap, settled: true })
      return
    }
    let disposed = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), kind === 'bootstrap' ? 12000 : 30000)
    setState(previous => ({ key, revision, data: previous.revision === revision &&
      (previous.key === key || kind === 'enrichment' || seed.checkIn.status === 'pending') && canRetainTodayStartup(previous.data, seed) ? previous.data : undefined }))
    const query = new URLSearchParams({ program: seed.program, clientId: seed.clientId, ownerUserId: seed.ownerUserId, date: seed.date, timezone: seed.timezone })
    async function load() {
      try {
        const response = await fetch(`/api/dashboard/today-${kind}?${query}`, { cache: 'no-store', signal: controller.signal })
        const payload = await response.json()
        if (disposed || current !== generation.current) return
        if (!response.ok) {
          if (payload.redirect || response.status === 401 || response.status === 403 || payload.safetyFlags) {
            setState({ key, revision, blocked: true, error: payload.error || 'Your access must be verified again.' })
            if (typeof payload.redirect === 'string' && payload.redirect.startsWith('/') && !payload.redirect.startsWith('//')) router.replace(payload.redirect)
            router.refresh()
            return
          }
          if (response.status === 409) router.refresh()
          throw new Error(payload.error || 'This part of Today could not be loaded. Try again.')
        }
        const data = kind === 'bootstrap' ? payload.bootstrap : payload
        if (!matchesTodayStartup(data, seed)) throw new Error('Today changed while loading. Refresh to confirm your current day.')
        if (kind === 'enrichment') {
          const value = data as TodayEnrichment
          const model = value.schedule?.todayViewModel
          if (!model || model.version !== 1 || model.clientId !== seed.clientId || model.tier !== seed.program ||
            model.date !== seed.date || model.timezone !== seed.timezone || model.generatedAt !== value.schedule.now ||
            value.logic?.client.id !== seed.clientId || value.logic.program !== seed.program || seed.carouselStyle !== 'step' && !model.daySections) {
            throw new Error('Your saved day could not be confirmed. Retry current guidance.')
          }
        }
        setState({ key, revision, data, settled: true })
      } catch (error) {
        if (disposed || current !== generation.current) return
        setState({ key, revision, error: error instanceof Error && error.name !== 'AbortError' ? error.message : 'This part of Today is taking longer than expected. Try again.' })
      } finally { window.clearTimeout(timeout) }
    }
    void load()
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout) }
  }, [key, kind, retry, revision, disabled, router, seed, initialBootstrap])
  if (initialBootstrap && !disabled) return { data: initialBootstrap, error: undefined, blocked: false, revalidating: false,
    retry: () => setRetry(previous => ({ key, count: previous.key === key ? previous.count + 1 : 1 })) }
  const active = state.revision === revision && !disabled && (state.key === key ||
    (kind === 'enrichment' || seed.checkIn.status === 'pending') && canRetainTodayStartup(state.data, seed)) ? state : null
  return { data: active?.data, error: active?.error, blocked: active?.blocked, revalidating: active?.key !== key || active?.settled !== true,
    retry: () => setRetry(previous => ({ key, count: previous.key === key ? previous.count + 1 : 1 })) }
}

export default function TodayStartup({ seed, startupTimings }: { seed: TodayBootstrap; startupTimings?: readonly DashboardTimingEntry[] }) {
  const router = useRouter()
  const startupKey = todayStartupKey(seed)
  const [now, setNow] = useState(seed.generatedAt)
  const [refreshState, setRefreshState] = useState({ key: startupKey, count: 0 })
  const revision = refreshState.key === startupKey ? refreshState.count : 0
  const [signedOut, setSignedOut] = useState(false)
  const reconciledBootstrap = useRef('')
  const wrongDay = localDateKey(new Date(now), seed.timezone) !== seed.date
  const bootstrapRequest = useTodayResource<TodayBootstrap>('bootstrap', seed, revision, signedOut || wrongDay)
  const enrichmentRequest = useTodayResource<TodayEnrichment>('enrichment', seed, revision, signedOut || wrongDay || bootstrapRequest.blocked === true)
  const blocked = signedOut || bootstrapRequest.blocked || enrichmentRequest.blocked
  const bootstrap = !blocked && !wrongDay ? bootstrapRequest.data : undefined
  // Do not activate any action if the independent completion verification failed.
  const candidate = enrichmentRequest.data
  const completionConflict = bootstrap?.checkIn.completed === true && candidate &&
    !candidate.schedule.todayViewModel?.today.activities.some(activity => activity.id === 'check-in' && activity.status === 'completed')
  const enrichment = bootstrap?.checkIn.status === 'ready' && !blocked && !wrongDay && !completionConflict ? candidate : undefined
  const model = enrichment?.schedule.todayViewModel
  const pending = !model
  const day = model?.daySections || bootstrap?.day || { ...seed.day, sections: seed.day.sections.map(section => ({ ...section, items: [] })), untimed: [] }
  const schedule = wrongDay ? { date: localDateKey(new Date(now), seed.timezone), timezone: seed.timezone, now, events: [] }
    : enrichment?.schedule || { date: seed.date, timezone: seed.timezone, now: seed.generatedAt, events: [] }
  const quiet = seed.carouselStyle === 'step'
  useDailyScheduleRefresh(schedule, !blocked && !wrongDay, model?.nextRefreshAt)

  useEffect(() => beginTodayStartup(startupTimings), [startupKey, revision, startupTimings])
  useEffect(() => {
    if (!completionConflict || !bootstrap || reconciledBootstrap.current === bootstrap.generatedAt) return
    reconciledBootstrap.current = bootstrap.generatedAt
    enrichmentRequest.retry()
  }, [completionConflict, bootstrap, enrichmentRequest])

  useEffect(() => {
    const updateClock = () => setNow(new Date().toISOString())
    const invalidate = () => setRefreshState(previous => ({ key: startupKey, count: previous.key === startupKey ? previous.count + 1 : 1 }))
    const saved = () => { updateClock(); invalidate() }
    const ended = () => { setSignedOut(true); invalidate() }
    updateClock()
    // Hide yesterday's actions at the boundary itself, before an RSC refresh
    // finishes. The shared refresh hook still owns event and pacing boundaries.
    const midnight = zonedDateTimeToUtc(addLocalDays(seed.date, 1), '00:00', seed.timezone).getTime()
    const timer = window.setTimeout(() => { updateClock(); router.refresh() }, Math.max(0, midnight - Date.now()) + 10)
    document.addEventListener('visibilitychange', updateClock)
    window.addEventListener('focus', updateClock)
    window.addEventListener('anastasis:daily-plan-updated', saved)
    window.addEventListener('anastasis:session-ended', ended)
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      if (!session || session.user.id !== seed.ownerUserId) { ended(); router.refresh() }
    })
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', updateClock)
      window.removeEventListener('focus', updateClock)
      window.removeEventListener('anastasis:daily-plan-updated', saved)
      window.removeEventListener('anastasis:session-ended', ended)
      subscription.unsubscribe()
    }
  }, [seed.ownerUserId, seed.clientId, seed.date, seed.timezone, startupKey, router])

  const checkInError = bootstrapRequest.error || (bootstrap?.checkIn.status === 'error' ? bootstrap.checkIn.message : undefined)
  const checkInCompleted = bootstrap?.checkIn.completed === true || model?.today.activities.some(activity => activity.id === 'check-in' && activity.status === 'completed')
  const partialSchedule = Boolean(enrichment?.schedule.unavailableSources?.length)
  return <div className={`today-dashboard ${styles.surface}`} data-tier={seed.program} data-dashboard-stage={pending ? 'bootstrap' : 'primary'}>
    <DashboardPerformance stage="today-layout-visible" snapshot={`${seed.generatedAt}:${revision}`} />
    {!quiet && !blocked && !wrongDay ? <DashboardPerformance stage="today-carousel-interactive" snapshot={`${seed.generatedAt}:${revision}`} /> : null}
    {bootstrap?.checkIn.status === 'ready' ? <DashboardPerformance stage="today-check-in-ready" snapshot={bootstrap.generatedAt} /> : null}
    {bootstrap?.checkIn.status === 'ready' && !checkInCompleted ? <DashboardPerformance stage="today-check-in-clickable" snapshot={bootstrap.generatedAt} /> : null}
    {enrichment ? <DashboardPerformance stage="primary" timings={enrichment.timings} actionable /> : null}
    {enrichment ? <DashboardPerformance stage="secondary" snapshot={enrichment.generatedAt} /> : null}
    <div className="today-shell">
      <TodayDashboardHeader memberName={blocked ? '' : seed.memberName} schedule={schedule} loading={pending}
        streak={enrichment ? { count: enrichment.logic.flameState?.streak, available: enrichment.logic.streakAvailable === true } : undefined} />
      <TodayInstallButton />
      <section className="tier-dashboard-workspace daily-home" data-tier={seed.program} data-quiet={quiet}>
        {blocked ? <p role="status">Your account or safety status changed. Verifying access to Today…</p> : wrongDay ? <div role="status"><p>A new local day has started. Loading your current day…</p><button type="button" onClick={() => router.refresh()}>Refresh Today</button></div> : <>
          <div role="status" aria-live="polite">
            {enrichment && (bootstrapRequest.revalidating || enrichmentRequest.revalidating) ? <p>Updating your current day…</p> : null}
            {checkInError ? <><p>{checkInError}</p><button type="button" onClick={bootstrapRequest.retry}>Retry check-in status</button></>
              : !bootstrap || bootstrap.checkIn.status === 'pending' ? <p>Confirming today’s daily check-in status…</p>
                : checkInCompleted ? <p>Today’s daily check-in is saved.</p>
                  : quiet && pending ? <Link className="tier-primary-action" href="/dashboard/check-in">Start daily check-in</Link> : null}
          </div>
          {!quiet ? <TodayDayCarousel day={day} timezone={seed.timezone} pending={pending || partialSchedule} keepAnytime onOpen={id => recordTodayActionOpened(seed.clientId, seed.date, id, seed.program)} /> : null}
          {enrichmentRequest.error ? <div role="status"><p>{enrichmentRequest.error}</p><button type="button" onClick={enrichmentRequest.retry}>Retry current guidance</button></div>
            : completionConflict ? <div role="status"><p>Your check-in is saved. Current guidance is being reconciled.</p><button type="button" onClick={enrichmentRequest.retry}>Retry current guidance</button></div>
            : pending ? <p role="status">Your hydration, nutrition, movement, recovery and progress are being confirmed. Current guidance will appear here.</p> : null}
          {partialSchedule ? <div role="status"><p>Some schedule details could not be confirmed. Other saved actions may still be pending.</p><button type="button" onClick={enrichmentRequest.retry}>Retry schedule details</button></div> : null}
          {enrichment ? <>
            {enrichment.savedPlanState.status !== 'ready' ? <aside className="aos-card" role="status"><h2>Your saved training plan needs attention.</h2><p>Review your saved assessments and plan setup before training.</p><Link href="/dashboard/onboarding/plan">Review plan setup</Link></aside> : null}
            <DeferredTodayGuidance key={`${seed.clientId}:${seed.date}`} logic={enrichment.logic} schedule={enrichment.schedule} presentation={quiet ? 'step' : 'section'} hideDayCarousel manageRefresh={false} />
          </> : null}
        </>}
      </section>
    </div>
  </div>
}
