'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'

const primaryActions = [
  { label: 'Today', href: '/dashboard/program/phoenix' },
  { label: 'Food', href: '/dashboard/nutrition' },
  { label: 'Body', href: '/dashboard/check-in' },
  { label: 'Coach', href: 'mailto:Anastasis.elite@gmail.com?subject=Phoenix%20Coach%20Support' },
]

const moreActions = [
  { label: 'Photos', href: '/dashboard/assessment/photos' },
  { label: 'Progress', href: '/dashboard/assessment/measurements' },
  { label: 'Recovery', href: '/dashboard/recovery' },
  { label: 'Training Plan', href: '/dashboard/program/phoenix/workout' },
  { label: 'Assessments', href: '/dashboard/assessment' },
]

export default function PhoenixDock() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const dockRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function closeOutside(event: MouseEvent | TouchEvent) {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('touchstart', closeOutside)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('touchstart', closeOutside)
    }
  }, [])

  return (
    <div ref={dockRef} className="phoenix-dock" aria-label="Phoenix navigation">
      {open ? (
        <div className="phoenix-dock-more">
          <p style={{ ...styles.eyebrowStyle, margin: '0 0 12px' }}>More</p>
          {moreActions.map((action) => (
            <Link key={action.label} href={action.href} onClick={() => setOpen(false)} style={moreLinkStyle}>{action.label}</Link>
          ))}
        </div>
      ) : null}

      <nav className="phoenix-dock-inner">
        {primaryActions.map((action) => {
          const active = action.href.startsWith('/') && pathname === action.href
          return action.href.startsWith('mailto:') ? (
            <a key={action.label} href={action.href} style={dockActionStyle}>{action.label}</a>
          ) : (
            <Link key={action.label} href={action.href} style={{ ...dockActionStyle, ...(active ? activeActionStyle : {}) }}>{action.label}</Link>
          )
        })}
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} style={dockButtonStyle}>More</button>
      </nav>
    </div>
  )
}

const dockActionStyle = { ...styles.secondaryButtonStyle, padding: '10px 13px', fontSize: '0.78rem', textAlign: 'center', minWidth: '58px', boxSizing: 'border-box' } as const
const dockButtonStyle = { ...dockActionStyle, cursor: 'pointer', fontFamily: 'inherit' } as const
const activeActionStyle = { background: 'rgba(181,110,67,.2)', borderColor: 'rgba(181,110,67,.48)' } as const
const moreLinkStyle = { ...styles.secondaryButtonStyle, display: 'block', padding: '11px 15px', fontSize: '0.86rem', textAlign: 'left' } as const
