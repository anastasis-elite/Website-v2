export default function ActionArrow({ className }: { className?: string }) {
  return <svg className={className} width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
    <circle cx="16" cy="16" r="14.5" />
    <path d="M11 21 21 11M11 11h10v10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
