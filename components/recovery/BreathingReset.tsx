import Link from 'next/link'

export default function BreathingReset({clientId:unusedClientId}:{clientId?:string}){void unusedClientId;return <Link className="phoenix-breathe-button" href="/dashboard/meditation?practice=breath-reset"><span aria-hidden="true">≋</span><strong>Breathe / Reset</strong><small>Open practice</small></Link>}
