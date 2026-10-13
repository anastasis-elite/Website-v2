'use client'

import { useEffect, useRef, useState } from 'react'

export default function PwaRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [applying, setApplying] = useState(false)
  const applyRequested = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return
    let disposed = false
    let registration: ServiceWorkerRegistration | undefined
    let installing: ServiceWorker | null = null
    let lastCheck = 0

    const showWaiting = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting)
      }
    }
    const updateFound = () => {
      installing?.removeEventListener('statechange', showWaiting)
      installing = registration?.installing || null
      installing?.addEventListener('statechange', showWaiting)
      showWaiting()
    }
    const checkForUpdate = () => {
      if (!registration || document.visibilityState !== 'visible' || !navigator.onLine) return
      if (Date.now() - lastCheck < 60_000) return
      lastCheck = Date.now()
      registration.update().catch(() => { /* Offline update checks must not block activity. */ })
    }
    const controllerChanged = () => {
      // Only this screen's explicit Apply update action permits a reload.
      if (applyRequested.current) {
        applyRequested.current = false
        window.location.reload()
      } else {
        setWaitingWorker(null)
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
    window.addEventListener('online', checkForUpdate)
    document.addEventListener('visibilitychange', checkForUpdate)
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((result) => {
      if (disposed) return
      registration = result
      registration.addEventListener('updatefound', updateFound)
      updateFound()
      checkForUpdate()
    }).catch((error) => console.error('Service worker registration failed:', error))

    return () => {
      disposed = true
      installing?.removeEventListener('statechange', showWaiting)
      registration?.removeEventListener('updatefound', updateFound)
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged)
      window.removeEventListener('online', checkForUpdate)
      document.removeEventListener('visibilitychange', checkForUpdate)
    }
  }, [])

  if (!waitingWorker) return null
  return (
    <aside role="status" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl border border-amber-200/30 bg-[#0b0908] p-4 text-sm text-stone-100 shadow-xl">
      <p className="font-semibold">Anastasis update ready</p>
      <p className="mt-1 text-stone-300">Save any open activity before applying this update.</p>
      <button type="button" disabled={applying} onClick={() => {
        applyRequested.current = true
        setApplying(true)
        waitingWorker.postMessage({ type: 'ACTIVATE_UPDATE' })
      }} className="mt-3 rounded-lg bg-amber-100 px-4 py-2 font-semibold text-stone-950 disabled:opacity-60">
        {applying ? 'Applying update…' : 'Apply update'}
      </button>
      <button type="button" disabled={applying} onClick={() => setWaitingWorker(null)} className="ml-3 rounded-lg px-3 py-2 text-stone-300 disabled:opacity-60">Later</button>
    </aside>
  )
}
