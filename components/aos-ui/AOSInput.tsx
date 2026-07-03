import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function AOSInput({ label, multiline = false, className = '', ...props }: ({ label: string; multiline?: false } & InputHTMLAttributes<HTMLInputElement>) | ({ label: string; multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>)) {
  if (multiline) return <label className={`aos-input ${className}`.trim()}><span>{label}</span><textarea {...props as TextareaHTMLAttributes<HTMLTextAreaElement>} /></label>
  return <label className={`aos-input ${className}`.trim()}><span>{label}</span><input {...props as InputHTMLAttributes<HTMLInputElement>} /></label>
}
