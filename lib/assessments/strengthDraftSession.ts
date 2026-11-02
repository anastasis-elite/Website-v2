// This session deliberately keeps unsaved health measurements in memory only.
// All persistence goes through the authenticated, owner-scoped assessment API.
export type StrengthFormValues = Record<string, string>

export type SavedStrengthAssessment = {
  status: 'draft' | 'completed'
  values: StrengthFormValues
  revision: number
  savedAt: string
  completedAt: string | null
  assessmentDate: string | null
  assessmentId?: string
  period?: string
}

export type StrengthResponse = {
  clientId?: string
  success?: boolean
  period: string
  currentPeriod: string
  assessment: SavedStrengthAssessment | null
  previousDraft?: SavedStrengthAssessment | null
  redirect?: string
  planStatus?: 'generated' | 'safety_paused' | 'existing' | 'retry'
  retryRoute?: string
  code?: string
  history?: Array<{ assessmentId: string; assessmentDate: string; status: 'completed'; period: string }>
}

export type StrengthSessionSnapshot = {
  values: StrengthFormValues
  loaded: boolean
  loading: boolean
  saving: boolean
  submitting: boolean
  unsaved: boolean
  status: 'draft' | 'completed' | null
  period: string | null
  currentPeriod: string | null
  revision: number
  savedAt: string | null
  completedAt: string | null
  assessmentDate: string | null
  previousDraft: SavedStrengthAssessment | null
  loadError: string | null
  saveError: string | null
  submitError: string | null
  conflict: boolean
  planStatus: StrengthResponse['planStatus'] | null
  redirect: string | null
  confirmedWrites: number
  assessmentId: string | null
  history: NonNullable<StrengthResponse['history']>
  monthChanged: boolean
}

type ResponsePayload = StrengthResponse & { error?: string }
type Transport = (method: 'GET' | 'PUT' | 'POST', body?: unknown, period?: string, assessmentId?: string) => Promise<StrengthResponse>

export class StrengthRequestError extends Error {
  constructor(public readonly code: string, public readonly payload?: Partial<ResponsePayload>) {
    super(code)
  }
}

export async function strengthAssessmentTransport(method: 'GET' | 'PUT' | 'POST', body?: unknown, period?: string, assessmentId?: string): Promise<StrengthResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const query = new URLSearchParams()
    if (method === 'GET' && period) query.set('period', period)
    if (method === 'GET' && assessmentId) query.set('assessmentId', assessmentId)
    const response = await fetch(`/api/assessment-strength${query.size ? `?${query}` : ''}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    const payload: ResponsePayload | null = await response.json().catch(() => null)
    if (!response.ok || !payload) throw new StrengthRequestError(payload?.code || (response.status === 401 ? 'unauthorized' : 'request_failed'), payload || undefined)
    // A successful HTTP response alone must never be presented as a confirmed save.
    if (!payload.period || !payload.currentPeriod || (method !== 'GET' && (payload.success !== true || !payload.assessment?.savedAt))) {
      throw new StrengthRequestError('unconfirmed')
    }
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

const unchanged = (left: StrengthFormValues, right: StrengthFormValues) => JSON.stringify(left) === JSON.stringify(right)

function safeFailure(error: unknown, action: 'load' | 'save' | 'submit') {
  const code = error instanceof StrengthRequestError ? error.code : ''
  if (code === 'unauthorized') return 'Your session has expired. Sign in again to save your assessment. Keep this page open to preserve your entered values.'
  if (code === 'account_changed') return 'The signed-in account has changed. Your measurements haven’t been saved to that account. Keep this page open and sign back in to the account you started with.'
  if (code === 'conflict') return 'A newer version of this assessment is saved in your account. Your entered values are still here. Review the saved assessment before continuing.'
  if (code === 'period_changed') return 'A new assessment month has started. Your entered values are still here. Choose Save entered values for the new month to continue.'
  if (code === 'validation') return 'Check your height and current weight. For each strength test, enter both a valid load and whole-number repetitions, or leave both blank.'
  return action === 'load'
    ? 'We couldn’t load your previous assessment. Retry.'
    : action === 'save'
      ? 'Your changes haven’t been saved yet. Retry saving.'
      : 'We couldn’t confirm that your assessment is complete. Your entered values are still here. Retry submission to check and safely complete it.'
}

/** Serializes cloud mutations and uses revisions to protect other sessions. */
export class StrengthDraftSession {
  private snapshot: StrengthSessionSnapshot
  private readonly listeners = new Set<() => void>()
  private persistedValues: StrengthFormValues
  private savePromise: Promise<boolean> | null = null
  private loadPromise: Promise<boolean> | null = null
  private submitPromise: Promise<boolean> | null = null

  constructor(private readonly defaults: StrengthFormValues, private readonly transport: Transport = strengthAssessmentTransport, private readonly expectedClientId?: string) {
    this.persistedValues = { ...defaults }
    this.snapshot = {
      values: { ...defaults }, loaded: false, loading: false, saving: false, submitting: false,
      unsaved: false, status: null, period: null, currentPeriod: null, revision: 0,
      savedAt: null, completedAt: null, assessmentDate: null, previousDraft: null,
      loadError: null, saveError: null, submitError: null, conflict: false, planStatus: null, redirect: null, confirmedWrites: 0, assessmentId: null, history: [], monthChanged: false,
    }
  }

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }

  private update(change: Partial<StrengthSessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change }
    for (const listener of this.listeners) listener()
  }

  private accept(payload: StrengthResponse, replaceValues: boolean, fromWrite = false) {
    if (this.expectedClientId && payload.clientId && payload.clientId !== this.expectedClientId) throw new StrengthRequestError('account_changed')
    const saved = payload.assessment
    const restored = { ...this.defaults, ...(saved?.values || {}) }
    this.persistedValues = restored
    const values = replaceValues ? restored : this.snapshot.values
    this.update({
      values, loaded: true, period: payload.period, currentPeriod: payload.currentPeriod,
      status: saved?.status || null, revision: saved?.revision || 0,
      savedAt: saved?.savedAt || null, completedAt: saved?.completedAt || null,
      assessmentDate: saved?.assessmentDate || null, previousDraft: payload.previousDraft || null,
      unsaved: saved?.status === 'completed' ? false : !unchanged(values, restored),
      planStatus: payload.planStatus || null, redirect: payload.redirect || null,
      confirmedWrites: this.snapshot.confirmedWrites + (fromWrite ? 1 : 0),
      assessmentId: saved?.assessmentId || null, history: payload.history || this.snapshot.history,
      monthChanged: false,
    })
  }

  load = (period?: string, assessmentId?: string): Promise<boolean> => {
    if (this.loadPromise) return this.loadPromise
    // Callers must explicitly resolve unsaved work before replacing it.
    if (this.snapshot.unsaved || this.snapshot.saving || this.snapshot.submitting) return Promise.resolve(false)
    this.update({ loading: true, loadError: null })
    this.loadPromise = (async () => {
      try {
        this.accept(await this.transport('GET', undefined, period, assessmentId), true)
        this.update({ saveError: null, submitError: null, conflict: false })
        return true
      } catch (error) {
        this.update({ loadError: safeFailure(error, 'load') })
        return false
      } finally {
        this.loadPromise = null
        this.update({ loading: false })
      }
    })()
    return this.loadPromise
  }

  change = (name: string, value: string) => {
    if (!this.snapshot.loaded || this.snapshot.loading || this.snapshot.submitting || this.snapshot.status === 'completed') return
    const values = { ...this.snapshot.values, [name]: value }
    this.update({ values, unsaved: !unchanged(values, this.persistedValues), submitError: null, saveError: this.snapshot.conflict ? this.snapshot.saveError : null })
  }

  save = (): Promise<boolean> => {
    if (this.savePromise) return this.savePromise
    if (!this.snapshot.loaded || this.snapshot.loading || this.snapshot.submitting || this.snapshot.conflict || this.snapshot.status === 'completed') return Promise.resolve(false)
    if (!this.snapshot.unsaved && this.snapshot.status === 'draft') return Promise.resolve(true)
    this.update({ saving: true, saveError: null })
    this.savePromise = (async () => {
      try {
        // Changes made during a request are saved next, using the confirmed revision.
        do {
          const values = { ...this.snapshot.values }
          const payload = await this.transport('PUT', { period: this.snapshot.period, revision: this.snapshot.revision, expectedClientId: this.expectedClientId, values })
          if (payload.success !== true || !payload.assessment?.savedAt || (payload.assessment.status !== 'draft' && payload.assessment.status !== 'completed')) throw new StrengthRequestError('unconfirmed')
          if (payload.assessment.status === 'completed' && !unchanged(this.snapshot.values, { ...this.defaults, ...payload.assessment.values })) throw new StrengthRequestError('conflict', payload)
          this.accept(payload, payload.assessment.status === 'completed', true)
        } while (this.snapshot.unsaved)
        return true
      } catch (error) {
        this.update({ saveError: safeFailure(error, 'save'), conflict: error instanceof StrengthRequestError && error.code === 'conflict' })
        this.acceptChangedMonth(error)
        return false
      } finally {
        this.savePromise = null
        this.update({ saving: false })
      }
    })()
    return this.savePromise
  }

  submit = (): Promise<boolean> => {
    if (this.submitPromise) return this.submitPromise
    if (!this.snapshot.loaded || this.snapshot.loading || this.snapshot.conflict || this.snapshot.status === 'completed') return Promise.resolve(false)
    this.update({ submitting: true, submitError: null })
    this.submitPromise = (async () => {
      try {
        // Wait for an already-running autosave before reading its revision.
        if (this.savePromise && !(await this.savePromise)) return false
        if (this.snapshot.status === 'completed') return true
        const payload = await this.transport('POST', { period: this.snapshot.period, revision: this.snapshot.revision, expectedClientId: this.expectedClientId, values: { ...this.snapshot.values } })
        if (payload.success !== true || !payload.assessment?.savedAt || payload.assessment.status !== 'completed' || !payload.assessment.completedAt) throw new StrengthRequestError('unconfirmed')
        if (!unchanged(this.snapshot.values, { ...this.defaults, ...payload.assessment.values })) throw new StrengthRequestError('conflict', payload)
        this.accept(payload, true, true)
        this.update({ saveError: null })
        return true
      } catch (error) {
        this.update({ submitError: safeFailure(error, 'submit'), conflict: error instanceof StrengthRequestError && error.code === 'conflict' })
        this.acceptChangedMonth(error)
        return false
      } finally {
        this.submitPromise = null
        this.update({ submitting: false })
      }
    })()
    return this.submitPromise
  }

  private acceptChangedMonth(error: unknown) {
    if (error instanceof StrengthRequestError && error.code === 'period_changed' && error.payload?.currentPeriod) {
      this.update({ currentPeriod: error.payload.currentPeriod, monthChanged: true })
    }
  }

  // An unsaved form opened before midnight can continue in the new month only
  // after an explicit choice and a fresh check that no saved record is replaced.
  continueInCurrentPeriod = async (): Promise<boolean> => {
    if (!this.snapshot.monthChanged || !this.snapshot.currentPeriod || this.snapshot.saving || this.snapshot.submitting || this.snapshot.loading) return false
    this.update({ loading: true })
    try {
      const payload = await this.transport('GET', undefined, this.snapshot.currentPeriod)
      if (payload.assessment) throw new StrengthRequestError('conflict', payload)
      this.accept(payload, false)
      this.update({ saveError: null, submitError: null, conflict: false, loading: false })
      return await this.save()
    } catch (error) {
      this.update({ saveError: safeFailure(error, 'save'), conflict: error instanceof StrengthRequestError && error.code === 'conflict' })
      return false
    } finally {
      this.update({ loading: false })
    }
  }

  // A reload after conflict is a deliberate choice; a failed read retains the edits.
  reviewSaved = async (): Promise<boolean> => {
    if (this.snapshot.saving || this.snapshot.submitting) return false
    this.update({ loading: true, loadError: null })
    try {
      this.accept(await this.transport('GET', undefined, this.snapshot.period || undefined), true)
      this.update({ conflict: false, saveError: null, submitError: null })
      return true
    } catch (error) {
      this.update({ loadError: safeFailure(error, 'load') })
      return false
    } finally {
      this.update({ loading: false })
    }
  }
}
