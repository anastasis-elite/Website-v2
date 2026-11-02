import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require=createRequire(import.meta.url),helper=await importTs('lib/membership/experience.ts')
const membership=await importTs('lib/membership/policy.ts')
const milestoneId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const openMilestone={id:milestoneId,months:6,due_at:'2026-11-01T12:00:00Z',reminder_due_at:'2026-11-01T12:00:00Z',status:'open',can_respond:true}
const loaded=(patch={})=>({clientId:'OWN',eligible:true,milestones:[openMilestone],...patch})
const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(' '):tree&&typeof tree==='object'?text(tree.props?.children):''
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(child=>nodes(child,predicate));return[...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)]}
function mount(path,initial=loaded(),pathname='/dashboard'){
  const states=[],refs=[],effects=[],pending=[],calls=[],listeners=new Map();let cursor=0,refCursor=0,effectCursor=0
  let currentState=initial
  const events=target=>({addEventListener(name,fn){const key=target+name;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn)},removeEventListener(name,fn){listeners.get(target+name)?.delete(fn)}})
  const document={...events('document:'),visibilityState:'visible'},window=events('window:')
  let send=async()=>Response.json({success:true,clientId:'OWN',milestone:{...openMilestone,status:'completed',can_respond:false,feedback:{response:{rating:3,continuation:'do_not_continue',comment:'Synthetic thoughts.'},submitted_at:'2026-11-01T12:10:00Z'}}})
  const react={useId:()=> 'experience',useState(value){const index=cursor++;if(!(index in states))states[index]=typeof value==='function'?value():value;return[states[index],next=>{states[index]=typeof next==='function'?next(states[index]):next}]},useRef(value){return refs[refCursor++]||=( {current:value})},useEffect(fn,deps){const index=effectCursor++,previous=effects[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i])))pending.push(()=>{previous?.cleanup?.();effects[index]={deps,cleanup:fn()}})}}
  const module={exports:{}},compiled=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  const forbidden=()=>{throw Error('Feedback must remain in memory and out of analytics/logs/AI')}
  const mocks={react,'next/link':{__esModule:true,default:'a'},'next/navigation':{usePathname:()=>pathname},'@/lib/membership/experience':helper}
  runInNewContext(compiled,{module,exports:module.exports,crypto:{randomUUID},Intl,Date,Error,document,window,localStorage:{getItem:forbidden,setItem:forbidden},sessionStorage:{getItem:forbidden,setItem:forbidden},console:{log:forbidden,error:forbidden},
    fetch:async(url,options={})=>{const call={url,method:options.method||'GET',body:options.body?JSON.parse(options.body):undefined};calls.push(call);if(call.method==='GET'){if(currentState instanceof Error)throw currentState;return Response.json(currentState)}return send(call)},
    require:name=>name.endsWith('.css')?{default:{card:'card',pageCard:'page-card',actions:'actions',history:'history'}}:mocks[name]||require(name)})
  const render=()=>{cursor=refCursor=effectCursor=0;const tree=module.exports.default({clientId:'OWN',timeZone:'Etc/UTC'});while(pending.length)pending.shift()();return tree}
  const button=label=>nodes(render(),node=>node.type==='button'&&text(node)===label)[0]
  const field=label=>nodes(nodes(render(),node=>node.type==='label'&&text(node).startsWith(label))[0],node=>['select','textarea'].includes(node.type))[0]
  return{render,button,field,calls,document,setInitial(value){currentState=value},dispatch(target,name){for(const fn of listeners.get(target+':'+name)||[])fn()},setSend(fn){send=fn},async ready(){render();await new Promise(setImmediate);render()},change(label,value){field(label).props.onChange({target:{value}})},submit(){return nodes(render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}})}}
}

test('the optional dashboard card stays absent until an eligible due row arrives and dismissing writes nothing',async()=>{
  const view=mount('components/membership/MembershipExperienceCard.tsx',loaded({eligible:false,milestones:[]}))
  assert.equal(view.render(),null,'The main dashboard is not blocked on a card read')
  await view.ready();assert.equal(view.render(),null)
  view.setInitial(loaded());view.document.visibilityState='hidden';view.dispatch('document','visibilitychange')
  assert.equal(view.calls.length,1)
  view.document.visibilityState='visible';view.dispatch('document','visibilitychange');view.dispatch('window','focus')
  await view.ready();assert.equal(view.calls.length,2,'Focus and visibility share one in-flight refresh')
  assert.match(text(view.render()),/6\s*-month membership check-in/)
  view.dispatch('window','anastasis:daily-plan-updated');await view.ready();assert.equal(view.calls.length,3)
  assert.equal(nodes(view.render(),node=>node.type==='dialog'||node.type==='form').length,0)
  assert.equal(nodes(view.render(),node=>node.type==='a')[0].props.href,'/dashboard/experience')
  view.button('Not now').props.onClick();assert.equal(view.render(),null)
  view.dispatch('window','focus');view.dispatch('window','anastasis:daily-plan-updated')
  assert.equal(view.calls.length,3);assert.ok(view.calls.every(call=>call.method==='GET'))
  for(const state of [loaded({eligible:false,milestones:[]}),loaded({milestones:[]}),loaded({clientId:'OTHER'}),new Error('Synthetic read failure')]){
    const unavailable=mount('components/membership/MembershipExperienceCard.tsx',state);await unavailable.ready();assert.equal(unavailable.render(),null)
  }
})

test('experience feedback starts blank and failed transport holds one in-memory payload for exact retry without billing side effects',async()=>{
  const view=mount('components/membership/MembershipExperienceFeedback.tsx');await view.ready()
  assert.match(view.render().props.className,/ph-no-capture ph-sensitive/)
  assert.equal(nodes(view.render(),node=>node.type==='form')[0].props.autoComplete,'off')
  assert.equal(view.field('How has').props.value,'');assert.equal(view.field('Would you').props.value,'')
  await view.submit();assert.equal(view.calls.filter(call=>call.method==='POST').length,0)
  view.change('How has','3');view.change('Would you','do_not_continue');view.change('Comments','Synthetic thoughts.')
  let finish;view.setSend(()=>new Promise(resolve=>{finish=resolve}))
  const pending=view.submit();await view.submit()
  assert.equal(view.calls.filter(call=>call.method==='POST').length,1)
  assert.equal(nodes(view.render(),node=>node.type==='fieldset')[0].props.disabled,true)
  assert.doesNotMatch(text(view.render()),/Thank you\. Your feedback is saved/)
  finish(Response.json({error:'Synthetic transport uncertainty'},{status:503}));await pending
  assert.doesNotMatch(text(view.render()),/Thank you\. Your feedback is saved/)
  const original=view.calls.at(-1)
  view.setSend(async()=>Response.json({success:true,clientId:'OWN',milestone:{...openMilestone,status:'completed',can_respond:false,feedback:{response:original.body.response,submitted_at:'2026-11-01T12:10:00Z'}}}))
  await view.submit();assert.deepEqual(view.calls.at(-1).body,original.body)
  assert.match(text(view.render()),/Thank you\. Your feedback is saved/)
  assert.match(text(view.render()),/Synthetic thoughts/)
  assert.ok(nodes(view.render(),node=>node.type==='a').some(node=>node.props.href==='/dashboard/account#billing'))
  assert.ok(view.calls.every(call=>call.url==='/api/membership/experience'))
  assert.equal(original.body.response.continuation,'do_not_continue');assert.equal(Object.hasOwn(original.body,'cancelSubscription'),false)
})

test('expired owner history remains readable without a response form or storage/analytics activity',async()=>{
  const response={rating:4,continuation:'continue',comment:'Historical synthetic feedback.'}
  const view=mount('components/membership/MembershipExperienceFeedback.tsx',loaded({eligible:false,milestones:[{...openMilestone,status:'completed',can_respond:false,feedback:{response,submitted_at:'2026-11-01T12:10:00Z'}}]}))
  await view.ready();assert.equal(nodes(view.render(),node=>node.type==='form').length,0);assert.match(text(view.render()),/Historical synthetic feedback/)
  assert.equal(view.calls.length,1);assert.equal(view.calls[0].method,'GET')
})

test('the shared layout keeps existing content and adds one optional card for paid and Tracker accounts only',async()=>{
  let tier='ignite'
  const contexts=[],module={exports:{}},compiled=ts.transpileModule(readFileSync('app/dashboard/layout.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  const stub=name=>({__esModule:true,default:name})
  const mocks={
    '@/lib/dashboard/getDashboardContext':{async getDashboardContext(options){contexts.push(options);return{client:{client_id:'OWN',program:tier,access:true,active:true,verified_purchase:false},user:{id:'owner'},supabase:{}}}},
    '@/lib/legal/hasCurrentLegalAcceptance':{},'@/lib/dashboard/isClientOnboardingComplete':{isClientOnboardingComplete:()=>true},
    '@/lib/commerce/access':{hasMemberAccess:membership.hasActiveMembership},'@/lib/membership/policy':membership,'@/lib/timezone':{getClientTimeZone:()=> 'Etc/UTC'},
    '@/components/membership/MembershipExperienceCard':stub('experience-card'),'@/components/DailyPlanRefresh':stub('daily-refresh'),
    '@/components/navigation/ClientDashboardNav':stub('navigation'),'@/components/tutorial/TutorialProvider':{TutorialProvider:'tutorial'},
    '@/components/tutorial/TutorialDevPanel':stub('dev-panel'),'@/components/tutorial/TutorialRenderer':stub('tutorial-renderer'),
    '@/components/program-dashboard/DashboardLoadingShell':stub('loading'),'next/link':stub('a'),'next/navigation':{redirect(){throw Error('The optional card must not add a gate')}},
  }
  runInNewContext(compiled,{module,exports:module.exports,process:{env:{}},require:name=>mocks[name]||require(name)})
  for(const value of ['free','tracker','ember','ignite','phoenix',null]){
    tier=value;const tree=module.exports.default({children:'Existing content stays usable'}),protectedLayout=tree.props.children
    const result=await protectedLayout.type(protectedLayout.props)
    assert.match(text(result),/Existing content stays usable/)
    assert.equal(nodes(result,node=>node.type==='experience-card').length,['tracker','ember','ignite','phoenix'].includes(tier)?1:0)
  }
  assert.ok(contexts.every(options=>options.allowInactiveAccess&&options.allowIncompleteOnboarding))
})
