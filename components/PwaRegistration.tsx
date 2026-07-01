'use client'

import { useEffect } from 'react'

export default function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed:', error)
      })
    }
  }, [])

  return null
}
