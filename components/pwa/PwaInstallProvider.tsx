'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type InstallPrompt = Event & {
  prompt: () => Promise<unknown>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
type Device = 'ios' | 'android' | 'desktop' | 'mobile'
type InstallState = {
  ready: boolean
  installed: boolean
  device: Device
  canPrompt: boolean
  busy: boolean
  result: 'idle' | 'accepted' | 'dismissed' | 'error'
}
const initialState: InstallState = { ready: false, installed: false, device: 'mobile', canPrompt: false, busy: false, result: 'idle' }
const InstallContext = createContext<InstallState & { install: () => void }>({ ...initialState, install() {} })

// This provider stays mounted across routes, retaining a prompt captured before Today opens.
export default function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState)
  const deferred = useRef<InstallPrompt | null>(null)
  const inFlight = useRef(false)
  const lifecycle = useRef({ active: false, attempt: 0 })

  useEffect(() => {
    const session = lifecycle.current
    session.active = true
    let installedHere = false
    const modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].map(mode => window.matchMedia(`(display-mode: ${mode})`))
    const isInstalled = () => installedHere || (navigator as Navigator & { standalone?: boolean }).standalone === true || modes.some(mode => mode.matches)
    const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const device: Device = ios ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    const refresh = () => {
      const installed = isInstalled()
      if (installed) {
        deferred.current = null
        inFlight.current = false
        session.attempt++
      }
      setState(current => ({ ...current, ready: true, device, installed, canPrompt: !!deferred.current, busy: inFlight.current }))
    }
    const capture = (event: Event) => {
      const candidate = event as Partial<InstallPrompt>
      if (isInstalled() || typeof candidate.prompt !== 'function' || typeof candidate.userChoice?.then !== 'function') return
      event.preventDefault()
      deferred.current = event as InstallPrompt
      setState(current => ({ ...current, canPrompt: true, result: 'idle' }))
    }
    const installed = () => { installedHere = true; refresh() }
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', installed)
    window.addEventListener('pageshow', refresh)
    modes.forEach(mode => mode.addEventListener('change', refresh))
    refresh()
    return () => {
      session.active = false
      session.attempt++
      deferred.current = null
      inFlight.current = false
      window.removeEventListener('beforeinstallprompt', capture)
      window.removeEventListener('appinstalled', installed)
      window.removeEventListener('pageshow', refresh)
      modes.forEach(mode => mode.removeEventListener('change', refresh))
    }
  }, [])

  const install = useCallback(() => {
    const session = lifecycle.current
    const event = deferred.current
    if (!session.active || inFlight.current || !event) return
    // The browser event is one-use. Consume it before calling prompt(), even if it fails.
    deferred.current = null
    inFlight.current = true
    const request = ++session.attempt
    setState(current => ({ ...current, canPrompt: false, busy: true, result: 'idle' }))
    const finish = (result: InstallState['result']) => {
      if (!session.active || session.attempt !== request) return
      inFlight.current = false
      setState(current => ({ ...current, busy: false, canPrompt: !!deferred.current, result }))
    }
    try {
      // Call synchronously from the button click to preserve browser user activation.
      const presentation = event.prompt()
      Promise.all([presentation, event.userChoice]).then(([, choice]) => {
        finish(choice.outcome === 'accepted' ? 'accepted' : 'dismissed')
      }).catch(() => finish('error'))
    } catch {
      // Observe a rejected choice as well when prompt() throws synchronously.
      void event.userChoice.catch(() => {})
      finish('error')
    }
  }, [])

  return <InstallContext.Provider value={{ ...state, install }}>{children}</InstallContext.Provider>
}

export const usePwaInstall = () => useContext(InstallContext)
