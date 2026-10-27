import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync,existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'
const require=createRequire(import.meta.url),sleepMath=await importTs('lib/sleep/calculateSleepHours.ts'),tiers=await importTs('lib/entitlements.ts')
const nodes=(tree,predicate)=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(child=>nodes(child,predicate)):[...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)]
const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(' '):tree&&typeof tree==='object'?text(tree.props?.children):''
function load(path,mocks={},globals={}){const module={exports:{}};const {outputText}=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});runInNewContext(outputText,{module,exports:module.exports,...globals,require:name=>name.endsWith('.css')?{}:mocks[name]||require(name)});return module.exports.default}
const tick=()=>new Promise(setImmediate)
function harness(path,props={},extraMocks={}){
 let index=0,refreshes=0,send=async()=>Response.json({success:true}),pathname='/dashboard/program/ignite',search=''
 const slots=[],effects=[],calls=[],timers=new Map(),navigation=[];let timerId=0
 const hook=(initial)=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]}
 const hooks={useState:hook,useRef(initial){return hook(()=>({current:initial}))[0]},useMemo(fn,deps){const i=index++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j]))slots[i]={value:fn(),deps};return slots[i].value},useCallback(fn,deps){return hooks.useMemo(()=>fn,deps)},useEffect(fn,deps){const i=index++;if(!slots[i]||!deps||deps.some((d,j)=>d!==slots[i].deps[j])){const previous=slots[i];slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn()})}}}
 const window={location:{search:'',assign:url=>navigation.push(url)},setInterval(fn){timers.set(++timerId,fn);return timerId},clearInterval(id){timers.delete(id)}}
 const Component=load(path,{react:hooks,'react-dom':{createPortal:node=>node},'next/link':'a','next/image':'img','next/navigation':{useRouter:()=>({refresh:()=>refreshes++,push:url=>navigation.push(url),replace:url=>navigation.push(url)}),usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams(search)},'@/lib/analytics':{trackEvent(){}},'@/lib/sleep/calculateSleepHours':sleepMath,'@/components/aos-ui/AOSButton':{AOSButton:'button'},'@/components/aos-ui/AOSInput':{AOSInput:'input'},'@/components/aos-ui/AOSChip':{AOSChip:'button'},'@/components/PostureLandmarkEditor':'div','@/lib/posture/landmarks':{postureInstructions:[],POSTURE_VIEW_LABELS:{front:'Front',back:'Back',left:'Left',right:'Right'}},...extraMocks},{window,document:{body:{style:{}},addEventListener(){},removeEventListener(){}},URL,URLSearchParams,FormData,console,alert(){},fetch:async(url,options)=>{calls.push({url,body:options.body instanceof FormData?options.body:JSON.parse(options.body)});return send(url,options)}})
 const view={render(){index=0;const tree=Component(props);effects.splice(0).forEach(fn=>fn());return tree},calls,navigation,setSend(fn){send=fn},setPath(path,query=''){pathname=path;search=query},get refreshes(){return refreshes},async advance(seconds){for(let n=0;n<seconds;n++){[...timers.values()].forEach(fn=>fn());view.render()}}}
 return view
}

test('five bottom tabs keep Community centered and Plan is stable across direct/deep routes',()=>{
 const view=harness('components/navigation/ClientDashboardNav.tsx',{program:'ignite'})
 for(const[path,query,active]of [['/dashboard/program/ignite','','today'],['/dashboard/program/ignite','view=plan','plan'],['/dashboard/program/ignite/plan','','plan'],['/dashboard/settings/calendars','','plan'],['/dashboard/community','','community'],['/dashboard/progress','','progress'],['/dashboard/account','','account']]){
  view.setPath(path,query);const links=nodes(view.render(),node=>node.type==='a');assert.deepEqual(links.map(link=>text(link).trim()),['Today','Plan','Community','Progress','Account']);assert.equal(links[2].props.href,'/dashboard/community');assert.equal(links.find(link=>link.props['aria-current']==='page').props['data-nav-item'],active);assert.equal(links[1].props.href,'/dashboard/program/ignite?view=plan')
 }
})

test('Account More tools preserves Cycle, day tools, calendars, Support and existing member routes',()=>{
 const view=harness('components/navigation/DashboardMoreMenu.tsx',{program:'phoenix'})
 nodes(view.render(),node=>node.type==='button')[0].props.onClick();const tree=view.render(),links=nodes(tree,node=>node.type==='a').map(node=>node.props.href)
 for(const href of ['/dashboard/cycle','/dashboard/check-in','/dashboard/settings/calendars','/dashboard/support','/dashboard/schedule/settings','/dashboard/assessment/monthly','/dashboard/nutrition#phoenix-recipes'])assert.ok(links.includes(href),href)
})

test('Sleep has no invented duration/quality, keeps edits after network failure and refreshes only confirmed saves',async()=>{
 const initial={duration:'',quality:'',bedtime:'',wakeTime:'',notes:''},view=harness('components/SleepLogger.tsx',{clientId:'owner',initial})
 assert.match(text(view.render()),/Not recorded/);await nodes(view.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(view.calls.length,0)
 const input=(label)=>nodes(view.render(),node=>node.props?.label===label)[0]
 input('Bedtime').props.onChange({target:{value:'23:00'}});input('Wake time').props.onChange({target:{value:'07:00'}});assert.equal(input('Duration (hours)').props.value,8)
 nodes(view.render(),node=>node.type==='input'&&node.props.type==='range')[0].props.onPointerUp({currentTarget:{value:'5'}})
 input('Notes (optional)').props.onChange({target:{value:'Retain this note'}})
 view.setSend(async()=>{throw new Error('Offline fixture')});await nodes(view.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(view.refreshes,0);assert.equal(input('Notes (optional)').props.value,'Retain this note');assert.match(text(view.render()),/connection and retry/)
 view.setSend(async()=>Response.json({success:true}));await nodes(view.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(view.refreshes,1);assert.equal(view.calls.at(-1).body.durationHours,8);assert.equal(view.calls.at(-1).body.quality,5)
 const reopened=harness('components/SleepLogger.tsx',{clientId:'owner',initial:{duration:8,quality:5,bedtime:'23:00',wakeTime:'07:00',notes:'Retain this note'}});assert.equal(nodes(reopened.render(),node=>node.props?.label==='Notes (optional)')[0].props.value,'Retain this note')
})

test('all four meditation practices preserve duration; early completion cannot fabricate a log; retry saves actual elapsed minutes',async()=>{
 const view=harness('components/meditation/MeditationPractice.tsx',{clientId:'owner',initialPractice:'breath-reset'})
 for(const label of ['2 min','5 min','10 min','8 min'])assert.ok(text(view.render()).replace(/ +/g,' ').includes(label))
 nodes(view.render(),node=>node.type==='button'&&text(node)==='Start practice')[0].props.onClick();view.render()
 let complete=()=>nodes(view.render(),node=>node.type==='button'&&text(node)==='Complete')[0]
 await complete().props.onClick();assert.equal(view.calls.length,0);assert.equal(complete().props.disabled,true)
 await view.advance(120);assert.equal(complete().props.disabled,false)
 view.setSend(async()=>Response.json({error:'Offline fixture'},{status:503}));await complete().props.onClick();assert.equal(view.refreshes,0);assert.match(text(view.render()),/Offline fixture/)
 view.setSend(async()=>Response.json({success:true}));await complete().props.onClick();assert.equal(view.refreshes,1);assert.equal(view.calls.at(-1).body.minutes,2);assert.equal(view.calls.at(-1).body.activityType,'Breathwork');assert.match(text(view.render()),/Practice logged/)
 assert.equal(nodes(view.render(),node=>node.type==='button'&&text(node)==='Logged')[0].props.disabled,true)
})

test('Posture entry chooses posture mode only for eligible members and retains the existing upload endpoint',async()=>{
 const eligible=harness('components/AssessmentPhotoUpload.tsx',{postureAssessmentEnabled:true,initialAssessmentType:'posture'});assert.match(text(eligible.render()),/Upload Posture Photos/)
 eligible.setSend(async()=>Response.json({error:'No photos uploaded'},{status:400}));await nodes(eligible.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(eligible.calls[0].url,'/api/assessment-photos/upload');assert.equal(eligible.calls[0].body.get('assessmentType'),'posture');assert.equal(eligible.refreshes,0)
 const ember=harness('components/AssessmentPhotoUpload.tsx',{postureAssessmentEnabled:false,initialAssessmentType:'posture'});assert.match(text(ember.render()),/Upload Progress Photos/);assert.doesNotMatch(text(ember.render()),/Posture review/)
})

test('calendar configuration/error states stay honest and preference save/reopen uses only existing endpoints',async()=>{
 const settings={connections:[],google_configured:false,icloud_configured:false,preferences:{default_calendar_id:null,timezone:'America/Chicago',preferred_start:'07:00',preferred_end:'21:00',buffer_minutes:10}},requests=[]
 let fail=true
 const view=harness('components/ConnectedCalendars.tsx',{}, {'@/lib/calendar/client':{announceCalendarChange(){},async calendarRequest(url,options={}){requests.push({url,body:options.body?JSON.parse(options.body):null});if(fail)throw new Error('Fixture disconnected');if(url==='/api/calendars/preferences')settings.preferences=JSON.parse(options.body);return structuredClone(settings)}}})
 view.render();await tick();let tree=view.render();assert.match(text(tree),/Settings could not be loaded/);assert.equal(nodes(tree,node=>node.type==='button'&&text(node)==='Connect iCloud Calendar')[0].props.disabled,true)
 fail=false;nodes(tree,node=>node.type==='button'&&text(node)==='Reload settings')[0].props.onClick();await tick();tree=view.render();assert.equal(nodes(tree,node=>node.type==='button'&&text(node)==='Connect Google Calendar')[0].props.disabled,true)
 const zone=nodes(tree,node=>node.type==='input'&&node.props.placeholder==='America/Chicago')[0];zone.props.onChange({target:{value:'America/New_York'}})
 const preferences=nodes(view.render(),node=>node.type==='form').at(-1);preferences.props.onSubmit({preventDefault(){}});await tick();tree=view.render();assert.match(text(tree),/Calendar preferences saved/);assert.equal(settings.preferences.timezone,'America/New_York');assert.ok(requests.every(row=>['/api/calendars','/api/calendars/preferences'].includes(row.url)))
})

const context={client:{client_id:'fixture-owner',auth_user_id:'fixture-user',program:'ember'},user:{id:'fixture-user'},supabase:{from(){throw new Error('Unauthorized query reached')}}}
test('Posture deep link and nutrient detail reject Ember before reading protected data',async()=>{
 const notFound=()=>{throw new Error('Not found')}
 const common={'next/navigation':{notFound},'@/components/phone-app/PhoneAppFrame':'div','@/lib/dashboard/getDashboardContext':{getDashboardContext:async()=>context},'@/lib/entitlements':tiers,'next/link':'a'}
 const Page=load('app/dashboard/assessment/photos/page.tsx',{...common,'@/components/AssessmentPhotoUpload':'div','@/components/ProgressPhotoComparison':{__esModule:true,default:'div',PhotoSetView:'div'},'@/lib/assessment/photoComparison':{}})
 await assert.rejects(Page({searchParams:Promise.resolve({type:'posture'})}),/Not found/)
 const Nutrient=load('app/dashboard/nutrition/nutrients/[nutrient]/page.tsx',{...common,'@/lib/nutrition/getNutrientInsights':{},'@/lib/nutrition/memberNutrition':{canTrackMicronutrients:program=>tiers.getTierCapabilities(program).nutritionMicronutrients}})
 await assert.rejects(Nutrient({params:Promise.resolve({nutrient:'magnesium'})}),/Not found/)
})

test('nutrient empty state uses reviewed relationships and Support keeps the verified email/billing destinations',async()=>{
 const filters=[];const q={select(){return q},eq(){return q},not(field,op,value){filters.push([field,op,value]);return q},limit:async()=>({data:[]}),maybeSingle:async()=>({data:{id:'magnesium',canonical_name:'Magnesium',review_status:'needs_authoritative_review',last_evidence_review_date:null}})}
 const Page=load('app/dashboard/nutrition/nutrients/[nutrient]/page.tsx',{'next/link':'a','next/navigation':{notFound(){throw new Error('not found')}},'@/components/phone-app/PhoneAppFrame':'div','@/lib/dashboard/getDashboardContext':{getDashboardContext:async()=>({...context,client:{...context.client,program:'ignite'},supabase:{from:()=>q}})},'@/lib/nutrition/getNutrientInsights':{getNutrientInsights:async()=>[]},'@/lib/nutrition/memberNutrition':{canTrackMicronutrients:()=>true}})
 const tree=await Page({params:Promise.resolve({nutrient:'magnesium'})});assert.match(text(tree),/No current insight is available/);assert.match(text(tree),/Review pending/);assert.match(text(tree),/No reviewed interactions/);assert.deepEqual(filters,[['last_reviewed_at','is',null]])
 const legal=await importTs('lib/legal/config.ts'),Support=load('app/support/page.tsx',{'next/link':'a','@/components/phone-app/PhoneAppFrame':'div','@/lib/legal/config':legal})
 const links=nodes(Support(),node=>node.type==='a').map(node=>node.props.href);assert.ok(links.includes(`mailto:${legal.LEGAL_CONTACT_EMAIL}?subject=Account%20Support`));assert.ok(links.includes('/dashboard/account#billing'));assert.ok(links.includes('/refund-policy'))
})

const owner={client_id:'fixture-owner',auth_user_id:'fixture-user',timezone:'UTC'}
function database() {
 const writes=[]
 return { writes, auth:{getUser:async()=>({data:{user:{id:owner.auth_user_id}}})},
  from(table) {
   if(table==='clients') {
    const filters={};const q={select(){return q},eq(key,value){filters[key]=value;return q},maybeSingle:async()=>({data:filters.client_id===owner.client_id&&filters.auth_user_id===owner.auth_user_id?owner:null})};return q
   }
   return {upsert:async(row)=>{writes.push({table,row});return {error:null}},insert:async(row)=>{writes.push({table,row});return {error:null}}}
  }
 }
}

const mocks={'next/server':'export const NextResponse={json:(value,options)=>Response.json(value,options)}','@/lib/supabase/server':'export async function createClient(){return globalThis.__finalPhoneFixture}','@/lib/dashboard/invalidateDailyPlan':'export function invalidateDailyPlan(){}'}
const sleepRoute=await importTs('app/api/sleep/route.ts',mocks),activityRoute=await importTs('app/api/recovery/activity/route.ts',mocks)
async function post(route,fixture,body){globalThis.__finalPhoneFixture=fixture;try{return await route.POST(new Request('http://fixture.invalid/api',{method:'POST',body:JSON.stringify(body)}))}finally{delete globalThis.__finalPhoneFixture}}
test('existing sleep/recovery endpoints keep ownership and real two-minute practice duration without live writes',async()=>{
 for(const route of [sleepRoute,activityRoute]){const fixture=database();assert.equal((await post(route,fixture,{clientId:'other-user',activityType:'Breathwork',minutes:2})).status,404);assert.equal(fixture.writes.length,0)}
 const sleep=database();assert.equal((await post(sleepRoute,sleep,{clientId:owner.client_id,bedtime:'23:00',wakeTime:'07:00',quality:5,notes:'Fixture note'})).status,200);assert.equal(sleep.writes[0].row.duration_hours,8);assert.equal(sleep.writes[0].row.user_id,owner.auth_user_id);assert.equal(sleep.writes[1].row.auth_user_id,owner.auth_user_id)
 for(const activityType of ['Breathwork','Meditation','Mobility']){const fixture=database();assert.equal((await post(activityRoute,fixture,{clientId:owner.client_id,activityType,minutes:2})).status,200);assert.equal(fixture.writes[0].row.duration_minutes,activityType==='Mobility'?5:2);assert.equal(fixture.writes[0].row.user_id,owner.auth_user_id)}
})

test('PWA starts in the member dashboard with existing icons and offline retry retains the requested deep link',async()=>{
 const manifest=(await importTs('app/manifest.ts',{'@/lib/seo':'export const BRAND_DESCRIPTION="Fixture"'})).default();assert.equal(manifest.start_url,'/dashboard');assert.equal(manifest.display,'standalone');for(const icon of manifest.icons)assert.ok(existsSync('public'+icon.src))
 const html=readFileSync('public/offline.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1]
 let handler,reloads=0,assigned;const location={pathname:'/dashboard/sleep',reload(){reloads++},assign(url){assigned=url}}
 runInNewContext(script,{document:{getElementById:()=>({addEventListener:(event,fn)=>{assert.equal(event,'click');handler=fn}})},location});handler();assert.equal(reloads,1);assert.equal(assigned,undefined);location.pathname='/offline.html';handler();assert.equal(assigned,'/dashboard');assert.match(html,/No new logs are confirmed while disconnected/)
})

test('existing day-block pages reopen saved partial selections and retain them after an offline save',async()=>{
 const view=harness('components/DayBlockCompletionForm.tsx',{clientId:'owner',block:'morning',items:['Water','Breakfast'],initialCompletedTasks:['morning-water']})
 let boxes=nodes(view.render(),node=>node.type==='input');assert.equal(boxes[0].props.checked,true);assert.equal(boxes[1].props.checked,false)
 view.setSend(async()=>{throw new Error('Offline')});await nodes(view.render(),node=>node.type==='button')[0].props.onClick();boxes=nodes(view.render(),node=>node.type==='input');assert.equal(boxes[0].props.checked,true);assert.equal(view.refreshes,0)
 view.setSend(async()=>Response.json({success:true}));await nodes(view.render(),node=>node.type==='button')[0].props.onClick();assert.deepEqual(view.calls.at(-1).body.completedTasks,['morning-water']);assert.equal(view.refreshes,1);assert.deepEqual(view.navigation,['/dashboard'])
})
