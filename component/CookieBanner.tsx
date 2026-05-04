'use client'

import { useState, useEffect } from 'react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) setVisible(true)
  }, [])

function accept() {
  localStorage.setItem('cookie_consent', 'accepted')
  setVisible(false)

  // Inject Google Analytics script AFTER consent
  const script1 = document.createElement('script')
  script1.src = "https://www.googletagmanager.com/gtag/js?id=G-TVXM35PHD0"
  script1.async = true
  document.head.appendChild(script1)

  const script2 = document.createElement('script')
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXXXXX', {
      page_path: window.location.pathname,
    });
  `
  document.head.appendChild(script2)
}

  function decline() {
    localStorage.setItem('cookie_consent', 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      width: '100%',
      background: '#000',
      color: '#fff',
      padding: '20px',
      zIndex: 1000
    }}>
      <p>
        We use cookies to improve your experience and analyze site traffic.
        You can accept or decline.
      </p>

      <button onClick={accept}>Accept</button>
      <button onClick={decline}>Decline</button>
    </div>
  )
}
