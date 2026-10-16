// Creates an isolated local Next app with copies of the real assessment UI.
// No environment files, account cookies, service credentials, or live API routes
// are copied. The smoke runner intercepts all assessment/auth transport.
import { copyFile, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const fixture = await mkdtemp('/private/tmp/strength-assessment-qa-')
for (const file of [
  'app/dashboard/assessment/start2/Start2Content.tsx', 'app/styles/globalstyles.ts', 'app/globals.css',
  'lib/assessments/strengthDraftSession.ts', 'lib/assessments/useStrengthDraft.ts',
  'components/StrengthAssessmentSummary.tsx', 'lib/assessment/getStrengthAssessmentStatus.ts',
  'lib/schedule/time.ts', 'lib/timezone.ts', 'components/navigation/DashboardMoreMenu.tsx',
]) {
  await mkdir(dirname(resolve(fixture, file)), { recursive: true })
  await copyFile(resolve(root, file), resolve(fixture, file))
}
const files = {
  'package.json': JSON.stringify({ name: 'isolated-strength-browser-qa', private: true, scripts: { dev: 'next dev' }, dependencies: { next: '15.5.18', react: '18.3.1', 'react-dom': '18.3.1' }, devDependencies: { typescript: 'latest' } }),
  'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2017', lib: ['dom', 'dom.iterable', 'esnext'], strict: true, noEmit: true, esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler', jsx: 'preserve', skipLibCheck: true, paths: { '@/*': ['./*'] }, plugins: [{ name: 'next' }] }, include: ['**/*.ts', '**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'] }),
  'next.config.js': 'module.exports={devIndicators:false,poweredByHeader:false}\n',
  'lib/analytics.ts': 'export function trackEvent(..._args:unknown[]) {}\n',
  'app/layout.tsx': `import './globals.css'; import Link from 'next/link'; import DashboardMoreMenu from '@/components/navigation/DashboardMoreMenu'; export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body><nav aria-label="Synthetic QA navigation"><Link href="/dashboard">QA Dashboard</Link> · <Link href="/dashboard/progress">QA Progress</Link><DashboardMoreMenu program="ember" /></nav>{children}</body></html> }`,
  'app/dashboard/assessment/start2/page.tsx': `import Start2Content from './Start2Content'; export default async function Page({searchParams}:{searchParams:Promise<{period?:string;assessmentId?:string}>}) { const query=await searchParams; const period=query.period&&/^[0-9]{4}-(0[1-9]|1[0-2])-01$/.test(query.period)?query.period:undefined; const assessmentId=query.assessmentId&&/^[a-zA-Z0-9_-]{1,100}$/.test(query.assessmentId)?query.assessmentId:undefined; return <Start2Content key={(period||'current')+':'+(assessmentId||'latest')} client={{client_id:'QA-STRENGTH-ONLY',full_name:'Synthetic QA Member',birthdate:''}} period={period} assessmentId={assessmentId} timeZone="America/Chicago" /> }`,
  'app/QADashboard.tsx': `'use client'; import {useEffect,useState} from 'react'; import Link from 'next/link'; import StrengthAssessmentSummary from '@/components/StrengthAssessmentSummary'; import {strengthAssessmentStatusFromRecords} from '@/lib/assessment/getStrengthAssessmentStatus'; export default function QADashboard({progress=false}:{progress?:boolean}) {const [payload,setPayload]=useState<any>(null);useEffect(()=>{void fetch('/api/assessment-strength',{cache:'no-store'}).then(r=>r.json()).then(setPayload)},[]);const assessment=payload?.assessment;const status=strengthAssessmentStatusFromRecords({period:payload?.period||'2026-10-01',session:assessment?{status:assessment.status,saved_at:assessment.savedAt,completed_at:assessment.completedAt,assessment_id:assessment.assessmentId}:null});return <main className="aos-flow-page"><div className="aos-flow-shell"><h1>{progress?'QA Progress':'QA Dashboard'}</h1>{payload?<StrengthAssessmentSummary status={status} client={{timezone:'America/Chicago'}}/>:<p>Loading status</p>}<Link href="/dashboard/assessment/start2?period=2026-09-01">Resume September Assessment</Link></div></main>}`,
  'app/dashboard/page.tsx': `import QADashboard from '../QADashboard'; export default function Page(){return <QADashboard/>}`,
  'app/dashboard/progress/page.tsx': `import QADashboard from '../../QADashboard'; export default function Page(){return <QADashboard progress/>}`,
  'app/login/page.tsx': `import Link from 'next/link'; export default function Page(){return <main><h1>Synthetic signed-out page</h1><Link href="/dashboard">Sign in to synthetic session</Link></main>}`,
}
for (const [file, content] of Object.entries(files)) {
  await mkdir(dirname(resolve(fixture, file)), { recursive: true })
  await writeFile(resolve(fixture, file), content)
}
await symlink(resolve(root, 'node_modules'), resolve(fixture, 'node_modules'), 'dir')
await writeFile('/private/tmp/strength-assessment-browser-fixture.json', JSON.stringify({ fixture, root }, null, 2) + '\n')
console.log(fixture)
