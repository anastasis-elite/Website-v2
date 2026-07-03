import type { ButtonHTMLAttributes } from 'react'

export function AOSButton({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button className={`aos-button aos-button--${variant} ${className}`.trim()} {...props} />
}
