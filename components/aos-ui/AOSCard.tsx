import type { FormEventHandler, ReactNode } from 'react'

export function AOSCard({ children, className = '', as = 'section', onSubmit }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'form'; onSubmit?: FormEventHandler<HTMLFormElement> }) {
  const classes = `aos-card ${className}`.trim()
  if (as === 'form') return <form className={classes} onSubmit={onSubmit}>{children}</form>
  if (as === 'div') return <div className={classes}>{children}</div>
  return <section className={classes}>{children}</section>
}
