'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AOSButton } from '@/components/aos-ui/AOSButton'

export function AOSModal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', handleKeyDown) }
  }, [open, onClose])
  if (!open) return null
  return <div className="aos-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="aos-modal" role="dialog" aria-modal="true" aria-label={title}><AOSButton variant="ghost" className="aos-modal__close" onClick={onClose} aria-label="Close dialog">×</AOSButton>{children}</section></div>
}
