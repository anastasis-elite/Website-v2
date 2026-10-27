import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'
const require=createRequire(import.meta.url),routes=await importTs('lib/day/dayBlockRoutes.ts')
function load(path,mocks={},globals={}){const module={exports:{}};const {outputText}=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});runInNewContext(outputText,{module,exports:module.exports,...globals,require:name=>name.endsWith('.css')?{}:mocks[name]||require(name)});return module.exports.default}
const nodes=(tree,fn)=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(node=>nodes(node,fn)):[...(fn(tree)?[tree]:[]),...nodes(tree.props?.children,fn)]
const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(' '):tree&&typeof tree==='object'?text(tree.props?.children):''
const date='2026-11-01',owner={client_id:'fixture-owner',auth_user_id:'fixture-user',program:'ignite',timezone:'America/Chicago'}
const blockCards=Object.keys(routes.dayBlockLabels).map(id=>({id,title:routes.dayBlockLabels[id],body:`Personalized ${id} focus`,timing:`Saved ${id} window`,macroTarget:{protein:37,carbs:52,fats:0,water:12},items:['Saved meal action','Saved hydration action']}))
function pageHarness({error=false}={}){
 const reads=[],calls=[];const plan={date,cards:structuredClone(blockCards)};const original=structuredClone(plan)
 const query={select(){return query},eq(key,value){reads.push([key,value]);return query},maybeSingle:async()=>({data:error?null:{daily_tasks:['morning-saved-meal-action']},error:error?{message:'Unavailable'}:null})}
 const Page=load('app/dashboard/day/[block]/page.tsx',{'next/link':'a','next/navigation':{notFound(){throw new Error('Not found')}},'@/lib/dashboard/getDashboardContext':{getDashboardContext:async()=>({client:owner,supabase:{from(table){assert.equal(table,'recovery_logs');return query}}})},'@/lib/day/getDailyExecutionPlan':{getDailyExecutionPlan:async(args)=>{calls.push(args);return plan}},'@/lib/timezone':{getClientLocalDate:()=>date},'@/lib/day/dayBlockRoutes':routes,'@/components/DayBlockCompletionForm':'fixture-form','@/components/phone-app/PhoneAppFrame':'fixture-frame'})
 return{Page,reads,calls,plan,original}
}

test('block entry and return helpers retain exact valid schedule dates',()=>{
 assert.equal(routes.dayBlockHref('morning','2026-10-31'),'/dashboard/day/morning?date=2026-10-31')
 assert.equal(routes.scheduleDayHref('2026-10-31'),'/dashboard/schedule?date=2026-10-31')
 for(const invalid of ['2026-02-30','2026-1-01',['2026-11-01'],'//example.invalid','2026-11-01#x'])assert.equal(routes.isDayBlockDate(invalid),false)
 assert.equal(routes.isDayBlockDate('2024-02-29'),true)
})

test('Review Schedule owns all three entries without mutating its selected date, events or calendar props',()=>{
 const events=[{id:'one',source:'manual',title:'Saved appointment',description:'Keep this',start_at:'2026-10-31T14:00:00Z',end_at:'2026-10-31T15:00:00Z',flexibility_type:'fixed',status:'scheduled',event_type:'appointment'}]
 const schedule={date:'2026-10-31',timezone:owner.timezone,program:'ignite',events,adjustments:[],overdueEvents:[],unavailableSources:[]},before=JSON.stringify(schedule),refreshed=[]
 const Component=load('app/dashboard/schedule/ScheduleDashboardClient.tsx',{'next/link':'a','@/lib/day/dayBlockRoutes':routes,'@/lib/schedule/time':{formatLocalTime:value=>value.slice(11,16)},'@/components/DailyPlanCard':'plan','@/components/ScheduleEventActions':'actions','@/components/CalendarWorkspace':'calendar','@/lib/schedule/client':{useDailyScheduleRefresh:value=>refreshed.push(value)},'@/components/phone-app/PhoneAppFrame':'frame'})
 const tree=Component({initialSchedule:schedule}),entries=nodes(tree,node=>node.type==='a'&&node.props.href.startsWith('/dashboard/day/'))
 assert.equal(entries.length,3);assert.deepEqual(entries.map(node=>node.props.href),['/dashboard/day/morning?date=2026-10-31','/dashboard/day/midday?date=2026-10-31','/dashboard/day/evening?date=2026-10-31'])
 assert.equal(nodes(tree,node=>node.type==='calendar')[0].props.date,'2026-10-31');assert.equal(nodes(tree,node=>node.type==='actions')[0].props.event,events[0]);assert.equal(JSON.stringify(schedule),before);assert.equal(refreshed[0],schedule)
})

test('each today block keeps personalized focus, targets and checklist data, with Schedule back/return destinations',async()=>{
 for(const block of Object.keys(routes.dayBlockLabels)){
  const view=pageHarness(),tree=await view.Page({params:Promise.resolve({block}),searchParams:Promise.resolve({date})})
  const frame=nodes(tree,node=>node.type==='fixture-frame')[0],form=nodes(tree,node=>node.type==='fixture-form')[0]
  assert.equal(frame.props.backHref,`/dashboard/schedule?date=${date}`);assert.equal(frame.props.backLabel,'Schedule');assert.equal(form.props.returnHref,frame.props.backHref);assert.equal(form.props.logDate,date)
  assert.deepEqual(form.props.items,blockCards.find(card=>card.id===block).items);assert.deepEqual(form.props.initialCompletedTasks,['morning-saved-meal-action'])
  assert.match(text(tree),new RegExp(`Personalized ${block} focus`));assert.match(text(tree),/37/);assert.match(text(tree),/52/)
  assert.deepEqual(view.reads,[['client_id',owner.client_id],['log_date',date]]);assert.deepEqual(view.plan,view.original)
  const links=nodes(tree,node=>node.type==='a').map(node=>node.props.href)
  assert.equal(links.includes('/dashboard/program/ignite/workout'),block==='midday');assert.equal(links.includes('/dashboard/check-in'),block==='evening')
 }
})

test('other selected dates do not relabel today data or permit historical/future writes; load failure cannot reset completion',async()=>{
 for(const selected of ['2026-10-31','2026-11-02']){
  const view=pageHarness(),tree=await view.Page({params:Promise.resolve({block:'morning'}),searchParams:Promise.resolve({date:selected})})
  assert.equal(view.calls.length,0);assert.equal(view.reads.length,0);assert.equal(nodes(tree,node=>node.type==='fixture-form').length,0);assert.equal(nodes(tree,node=>node.type==='fixture-frame')[0].props.backHref,`/dashboard/schedule?date=${selected}`);assert.match(text(tree),/unavailable here/)
 }
 const view=pageHarness({error:true}),tree=await view.Page({params:Promise.resolve({block:'morning'}),searchParams:Promise.resolve({date})});assert.equal(nodes(tree,node=>node.type==='fixture-form').length,0);assert.match(text(tree),/saved checklist could not be loaded/)
 await assert.rejects(view.Page({params:Promise.resolve({block:'night'}),searchParams:Promise.resolve({date})}),/Not found/)
 await assert.rejects(view.Page({params:Promise.resolve({block:'morning'}),searchParams:Promise.resolve({date:'2026-02-30'})}),/Not found/)
})

function formHarness(initial={}){
 const states=[],refs=[],calls=[],navigation=[];let index=0,refIndex=0,refreshes=0,send=async()=>Response.json({success:true})
 const Component=load('components/DayBlockCompletionForm.tsx',{react:{useState(value){const i=index++;if(!(i in states))states[i]=typeof value==='function'?value():value;return[states[i],next=>states[i]=typeof next==='function'?next(states[i]):next]},useMemo:fn=>fn(),useRef:value=>refs[refIndex++]||={current:value}},'next/navigation':{useRouter:()=>({push:href=>navigation.push(href),refresh:()=>refreshes++})},'@/components/aos-ui/AOSButton':{AOSButton:'button'}},{fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return send()}})
 const props={clientId:owner.client_id,block:'morning',items:['Saved meal action','Saved hydration action'],initialCompletedTasks:['morning-saved-meal-action'],returnHref:`/dashboard/schedule?date=${date}`,logDate:date,...initial}
 return{render(){index=refIndex=0;return Component(props)},calls,navigation,setSend(fn){send=fn},get refreshes(){return refreshes}}
}
test('checklist reopens saved selections, keeps them on failed/unconfirmed saves, and returns to Schedule only after confirmation',async()=>{
 const view=formHarness();let tree=view.render();const boxes=nodes(tree,node=>node.type==='input');assert.equal(boxes[0].props.checked,true);assert.equal(boxes[1].props.checked,false)
 view.setSend(async()=>{throw new Error('Offline')});await nodes(tree,node=>node.type==='button')[0].props.onClick();assert.equal(view.refreshes,0);assert.equal(nodes(view.render(),node=>node.type==='input')[0].props.checked,true)
 view.setSend(async()=>Response.json({}));await nodes(view.render(),node=>node.type==='button')[0].props.onClick();assert.equal(view.navigation.length,0)
 view.setSend(async()=>Response.json({success:true}));await nodes(view.render(),node=>node.type==='button')[0].props.onClick();assert.deepEqual(view.calls.at(-1).body,{clientId:owner.client_id,block:'morning',completedTasks:['morning-saved-meal-action'],logDate:date});assert.deepEqual(view.navigation,[`/dashboard/schedule?date=${date}`]);assert.equal(view.refreshes,1)
 const reopened=formHarness({initialCompleted:true});assert.ok(nodes(reopened.render(),node=>node.type==='input').every(node=>node.props.checked))
})

const route=await importTs('app/api/day-block/complete/route.ts',{'next/server':'export const NextResponse={json:(value,options)=>Response.json(value,options)}','@/lib/supabase/server':'export async function createClient(){return globalThis.__dayBlockFixture}','@/lib/dashboard/invalidateDailyPlan':'export function invalidateDailyPlan(){}','@/lib/timezone':`export function getClientLocalDate(){return '${date}'}`})
function database(failRead=false){const rows=[{id:'owner-row',client_id:owner.client_id,auth_user_id:owner.auth_user_id,log_date:date,daily_tasks:['evening-water'],notes:'Keep this',sleep_hours:8},{id:'other-row',client_id:'other-client',auth_user_id:'other-user',log_date:date,daily_tasks:['private']}],original=structuredClone(rows),writes=[];return{rows,original,writes,auth:{getUser:async()=>({data:{user:{id:owner.auth_user_id}}})},from(table){let payload,filters={};const q={select(columns){if(table==='clients')assert.ok(columns.includes('onboarding_data'),'The date guard must use the same saved timezone sources as the dashboard');return q},eq(key,value){filters[key]=value;return q},update(value){payload=value;return q},maybeSingle:async()=>{if(table==='clients')return{data:filters.client_id===owner.client_id&&filters.auth_user_id===owner.auth_user_id?owner:null};assert.equal(table,'recovery_logs');if(failRead)return{data:null,error:{message:'Unavailable fixture'}};const row=rows.find(row=>row.client_id===filters.client_id&&row.log_date===filters.log_date);if(payload&&row){writes.push(payload);Object.assign(row,payload)}return{data:row||null,error:null}},insert:async(value)=>{writes.push(value);return{error:null}}};return q}}}
async function post(db,changes={}){globalThis.__dayBlockFixture=db;try{return await route.POST(new Request('http://fixture.invalid/api/day-block/complete',{method:'POST',body:JSON.stringify({clientId:owner.client_id,block:'morning',completedTasks:['morning-saved-meal-action'],logDate:date,...changes})}))}finally{delete globalThis.__dayBlockFixture}}
test('day completion rejects stale/wrong dates and foreign ownership before writes while preserving existing completion semantics',async()=>{
 for(const changes of [{logDate:'2026-10-31'},{logDate:'2026-11-02'},{clientId:'other-client'}]){const db=database();assert.ok([404,409].includes((await post(db,changes)).status));assert.equal(db.writes.length,0);assert.deepEqual(db.rows,db.original)}
 const unavailable=database(true);assert.equal((await post(unavailable)).status,503);assert.equal(unavailable.writes.length,0);assert.deepEqual(unavailable.rows,unavailable.original)
 const db=database();assert.equal((await post(db)).status,200);assert.ok(db.rows[0].daily_tasks.includes('morning-complete'));assert.ok(db.rows[0].daily_tasks.includes('evening-water'));assert.equal(db.rows[0].notes,'Keep this');assert.equal(db.rows[0].sleep_hours,8);assert.deepEqual(db.rows[1],db.original[1])
})

test('Today remains the main dashboard while a block is open and Community stays the center tab',()=>{
 const Nav=load('components/navigation/ClientDashboardNav.tsx',{'next/link':'a','next/navigation':{usePathname:()=>'/dashboard/day/morning',useSearchParams:()=>new URLSearchParams({date})},'@/lib/analytics':{trackEvent(){}}})
 const links=nodes(Nav({program:'ignite'}),node=>node.type==='a');assert.equal(links[0].props.href,'/dashboard/program/ignite');assert.equal(links[0].props.href.includes('#'),false);assert.deepEqual(links.map(node=>text(node).trim()),['Today','Plan','Community','Progress','Account'])
})
