import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require=createRequire(import.meta.url)
const status=await importTs('lib/assessment/getStrengthAssessmentStatus.ts')
const module={exports:{}}
const compiled=ts.transpileModule(readFileSync('components/StrengthAssessmentSummary.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
runInNewContext(compiled,{module,exports:module.exports,require:name=>name==='next/link'?{__esModule:true,default:'a'}:name==='@/lib/assessment/getStrengthAssessmentStatus'?status:require(name)})
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(node=>nodes(node,predicate));return[...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)]}
const text=tree=>typeof tree==='string'?tree:Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):''
const client={timezone:'America/Chicago'}
test('strength summary exposes owned cloud status and separate earlier-draft restoration without performance values',()=>{
  const value=status.strengthAssessmentStatusFromRecords({period:'2026-11-01',session:{status:'draft',saved_at:'2026-11-01T16:00:00Z'},previousDraft:{status:'draft',period:'2026-10-01',saved_at:'2026-10-20T16:00:00Z'}})
  const tree=module.exports.default({status:value,client})
  assert.match(text(tree),/In Progress/);assert.match(text(tree),/Last saved/)
  assert.deepEqual(nodes(tree,node=>node.type==='a').map(node=>node.props.href),['/dashboard/assessment/start2?period=2026-11-01','/dashboard/assessment/start2?period=2026-10-01'])
  assert.doesNotMatch(text(tree),/weight|reps|email|pain|capacity score/i)
})
test('current shared assessment sections use the same status and do not duplicate a monthly strength card',()=>{
  const month=readFileSync('app/dashboard/assessment/monthly/page.tsx','utf8')
  assert.match(month,/<StrengthAssessmentSummary status=\{strength\} client=\{client\}/)
  assert.match(month,/due\.filter\(item => item\.id !== 'strength'\)/)
  for(const file of ['components/workout-dashboard/WorkoutDashboard.tsx','components/program-dashboard/DashboardDetailPanels.tsx'])assert.match(readFileSync(file,'utf8'),/previousDraft\.href/)
})
