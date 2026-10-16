'use client'

import { useEffect } from 'react'
import { StrengthDraftSession, type StrengthSessionSnapshot } from './strengthDraftSession'

export const ASSESSMENT_BEFORE_NAVIGATION_EVENT = 'anastasis:before-assessment-navigation'

export function useStrengthDraftAutosave(session: StrengthDraftSession, state: StrengthSessionSnapshot, offline: boolean) {
  useEffect(() => {
    if (!state.loaded || !state.unsaved || state.saving || state.submitting || state.saveError || state.conflict || offline) return
    const timer = window.setTimeout(() => { void session.save() }, 800)
    return () => window.clearTimeout(timer)
  }, [session, state.loaded, state.unsaved, state.values, state.saving, state.submitting, state.saveError, state.conflict, offline])
}

export function useUnsavedAssessmentGuard(session: StrengthDraftSession) {
  useEffect(() => {
    const locationBeforeNavigation = window.location.href
    const stateBeforeNavigation = window.history.state
    const hasUnsavedWork = () => { const state = session.getSnapshot(); return state.unsaved || state.saving || state.submitting }
    const confirmLeaving = () => window.confirm('Your latest measurements haven’t been saved to your account. Leave this page and discard these changes?')
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedWork()) return
      event.preventDefault()
      event.returnValue = ''
    }
    const click = (event: MouseEvent) => {
      if (!hasUnsavedWork() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!anchor || anchor.download || anchor.target && anchor.target !== '_self' || anchor.href === window.location.href || anchor.getAttribute('href')?.startsWith('#')) return
      if (!confirmLeaving()) { event.preventDefault(); event.stopPropagation() }
    }
    const backOrForward = (event: PopStateEvent) => {
      if (!hasUnsavedWork() || confirmLeaving()) return
      // Capture runs before the app router can unmount the form. Restore the
      // original history state and URL while keeping all measurements in memory.
      event.stopImmediatePropagation()
      window.history.pushState(stateBeforeNavigation, '', locationBeforeNavigation)
    }
    const programmaticNavigation = (event: Event) => {
      if (hasUnsavedWork() && !confirmLeaving()) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', click, true)
    window.addEventListener('popstate', backOrForward, true)
    window.addEventListener(ASSESSMENT_BEFORE_NAVIGATION_EVENT, programmaticNavigation)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', click, true)
      window.removeEventListener('popstate', backOrForward, true)
      window.removeEventListener(ASSESSMENT_BEFORE_NAVIGATION_EVENT, programmaticNavigation)
    }
  }, [session])
}
