import type { ButtonHTMLAttributes } from 'react'

export function AOSChip({ selected = false, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type="button" aria-pressed={selected} className={`aos-chip ${selected ? 'is-selected' : ''} ${className}`.trim()} {...props} />
}
