'use client'

export default function TodayError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="today-dashboard"><div className="today-shell"><section className="today-next" role="alert"><h1>Your day couldn’t load.</h1><p>Check your connection and try again. This screen could not confirm your latest saved activities.</p><button className="tier-primary-action" type="button" onClick={reset}>Try again</button></section></div></main>
}
