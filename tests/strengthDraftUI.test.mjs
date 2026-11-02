import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require=createRequire(import.meta.url)
const sessions=await importTs('lib/assessments/strengthDraftSession.ts')
const form=await importTs('lib/assessment/strengthForm.ts')
const fields=await importTs('lib/assessments/strengthAssessment.ts')
const historyGuard=await importTs('lib/assessments/strengthHistoryGuard.ts')
const tick=()=>new Promise(resolve=>setImmediate(resolve))
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(child=>nodes(child,predicate));return[...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)]}
const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(' '):tree&&typeof tree==='object'?text(tree.props?.children):''
function load(path,mocks,globals={}){
  const module={exports:{}}
  const output=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  runInNewContext(output,{module,exports:module.exports,Error,Event,URL,...globals,require:name=>name.endsWith('.css')?{}:mocks[name]||require(name)})
  return module.exports
}
function assessment({saved=null,failWrite=false,canEdit=true}={}){
  const states=[],refs=[],effects=[],pending=[],requests=[],autosaveFlags=[]
  let cursor=0,refCursor=0,effectCursor=0,refreshes=0
  const browser={addEventListener(){},removeEventListener(){},dispatchEvent(){return true},confirm:()=>false}
  const router={refresh(){refreshes++}}
  let activeSession
  class TestSession extends sessions.StrengthDraftSession{
    constructor(defaults,_transport,clientId){super(defaults,async(method,body,period,assessmentId)=>{
      requests.push({method,body,period,assessmentId})
      if(method!=='GET'&&failWrite)throw new Error('synthetic failure')
      if(method!=='GET')saved={status:method==='POST'?'completed':'draft',values:body.values,revision:(saved?.revision||0)+1,savedAt:'2026-11-01T15:00:00Z',completedAt:method==='POST'?'2026-11-01T15:00:00Z':null,assessmentDate:method==='POST'?'2026-11-01T15:00:00Z':null,assessmentId:method==='POST'?'saved-assessment':null}
      return{success:true,clientId,period:period||body?.period||'2026-11-01',currentPeriod:'2026-11-01',assessment:saved,history:saved?.status==='completed'?[{assessmentId:saved.assessmentId,period:'2026-11-01',assessmentDate:saved.assessmentDate,status:'completed'}]:[]}
    },clientId);activeSession=this}
  }
  const Component=load('app/dashboard/assessment/start2/Start2Content.tsx',{
    react:{useState(initial){const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return[states[index],value=>states[index]=typeof value==='function'?value(states[index]):value]},useRef(initial){return refs[refCursor++]||=( {current:initial})},useSyncExternalStore(_subscribe,get){return get()},useEffect(fn,deps){const index=effectCursor++,old=effects[index];if(!old||deps.some((value,i)=>value!==old.deps[i]))pending.push(()=>{old?.cleanup?.();effects[index]={deps,cleanup:fn()}})}},
    'next/navigation':{useRouter:()=>router},'next/link':{__esModule:true,default:'a'},
    '@/components/phone-app/PhoneAppFrame':{__esModule:true,default:'phone-frame'},
    '@/lib/assessment/strengthForm':form,'@/lib/assessments/strengthAssessment':fields,
    '@/lib/assessments/strengthDraftSession':{StrengthDraftSession:TestSession},
    '@/lib/assessments/useStrengthDraft':{useUnsavedAssessmentGuard(){},useStrengthDraftAutosave(_session,_state,blocked){autosaveFlags.push(blocked)}},
  },{window:browser,navigator:{onLine:true}}).default
  const props={client:{client_id:'OWNER-ONLY',full_name:'Synthetic Member',height_in:67,birthdate:'1990-01-01'},history:{completedAt:'2026-10-15T12:00:00Z',values:{squat_weight:'25'},unavailable:false},timeZone:'Etc/UTC',canEdit}
  const render=()=>{cursor=refCursor=effectCursor=0;const tree=Component(props);while(pending.length)pending.shift()();return tree}
  const button=label=>nodes(render(),node=>node.type==='button'&&text(node)===label)[0]
  return{render,button,requests,autosaveFlags,field:name=>nodes(render(),node=>node.type==='input'&&node.props.name===name)[0],get session(){return activeSession},get refreshes(){return refreshes},async ready(){render();await tick();return render()},async flush(){await tick();return render()}}
}

test('current assessment layout restores a cloud draft, keeps comparisons separate and confirms saving only after success',async()=>{
  const app=assessment();await app.ready()
  assert.equal(app.render().type,'phone-frame')
  assert.equal(app.field('height_in').props.value,'67')
  assert.equal(app.field('weight').props.value,'')
  assert.equal(app.field('squat_weight').props.value,'')
  for(const name of ['height_in','weight','weight_goal','squat_weight','squat_reps','plank_time'])assert.notEqual(app.field(name).props.type,'number')
  assert.equal(app.field('squat_weight').props.inputMode,'decimal')
  assert.equal(app.field('squat_reps').props.inputMode,'numeric')
  assert.match(text(app.render()),/Last: 25 lb/)
  app.field('weight').props.onChange({target:{name:'weight',value:'151.5'}})
  assert.match(text(app.render()),/Changes haven’t been saved yet/)
  app.button('Save Draft').props.onClick();await app.flush()
  assert.match(text(app.render()),/Last successful cloud save/)
  assert.equal(app.requests.at(-1).body.expectedClientId,'OWNER-ONLY')
  assert.equal(app.requests.at(-1).body.values.weight,'151.5')
  assert.equal(app.requests.at(-1).body.values.email,undefined)
  assert.equal(app.refreshes,1)
  const restored=assessment({saved:{status:'draft',values:{weight:'151.5',squat_weight:'12.'},revision:2,savedAt:'2026-11-01T15:00:00Z',completedAt:null,assessmentDate:null}})
  await restored.ready()
  assert.equal(restored.field('weight').props.value,'151.5')
  assert.equal(restored.field('squat_weight').props.value,'12.')
})

test('failed writes retain entered measurements and completed results stay read-only with their original date',async()=>{
  const app=assessment({failWrite:true});await app.ready()
  app.field('weight').props.onChange({target:{name:'weight',value:'158'}})
  app.button('Save Draft').props.onClick();await app.flush()
  assert.equal(app.field('weight').props.value,'158')
  assert.match(text(app.render()),/haven’t been saved yet/)
  assert.ok(app.button('Retry Saving Draft'))
  const completed=assessment({saved:{status:'completed',values:{weight:'149',squat_weight:'30',squat_reps:'8'},revision:3,savedAt:'2026-10-16T13:00:00Z',completedAt:'2026-10-16T13:00:00Z',assessmentDate:'2026-10-16T13:00:00Z',assessmentId:'original'}})
  await completed.ready()
  assert.equal(completed.field('weight').props.value,'149')
  assert.match(text(completed.render()),/Original assessment date/)
  assert.match(text(completed.render()),/read-only/)
  assert.ok(nodes(completed.render(),node=>node.type==='fieldset').every(node=>node.props.disabled===true))
  assert.equal(completed.button('Submit Assessment'),undefined)
})

test('ineligible owners can restore history without editable controls, autosave or a submit request',async()=>{
  const app=assessment({canEdit:false,saved:{status:'draft',values:{weight:'151.5'},revision:2,savedAt:'2026-11-01T15:00:00Z',completedAt:null,assessmentDate:null}})
  await app.ready()
  assert.equal(app.field('weight').props.value,'151.5')
  assert.match(text(app.render()),/eligible active membership/)
  assert.ok(nodes(app.render(),node=>node.type==='fieldset').every(node=>node.props.disabled===true))
  assert.equal(app.button('Save Draft').props.disabled,true)
  assert.equal(app.button('Submit Assessment').props.disabled,true)
  assert.ok(app.autosaveFlags.every(Boolean))
  await nodes(app.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}})
  assert.equal(app.requests.some(request=>request.method!=='GET'),false)
})

test('autosave debounces at 800ms and cancels stale timers, failures and offline saves',async()=>{
  const timers=new Map(),cleared=[],effects=[];let nextId=0,saves=0
  const browser={setTimeout(fn,delay){const id=++nextId;timers.set(id,{fn,delay});return id},clearTimeout(id){cleared.push(id);timers.delete(id)}}
  const hooks=load('lib/assessments/useStrengthDraft.ts',{react:{useEffect(fn){effects.push(fn)}},'./strengthHistoryGuard':{}},{window:browser})
  const session={save(){saves++;return Promise.resolve(true)}}
  const state={loaded:true,unsaved:true,saving:false,submitting:false,saveError:null,conflict:false,values:{weight:'1'}}
  hooks.useStrengthDraftAutosave(session,state,false)
  const cleanup=effects.pop()();assert.equal([...timers.values()][0].delay,800)
  cleanup();assert.equal(timers.size,0);assert.equal(cleared.length,1)
  hooks.useStrengthDraftAutosave(session,{...state,values:{weight:'12'}},false);effects.pop()()
  const timer=[...timers.values()][0];timer.fn();assert.equal(saves,1)
  for(const blocked of [{...state,saving:true},{...state,submitting:true},{...state,saveError:'Failed'},{...state,conflict:true}]){hooks.useStrengthDraftAutosave(session,blocked,false);assert.equal(effects.pop()(),undefined)}
  hooks.useStrengthDraftAutosave(session,state,true);assert.equal(effects.pop()(),undefined)
})

test('browser back, unload and cancelable logout preserve unsaved memory when navigation is declined',async()=>{
  const listeners=new Map(),documentListeners=new Map(),effects=[];let guard,restored=0
  const browser={location:{href:'https://local.test/dashboard/assessment/start2'},history:{state:{test:true}},History:{prototype:{pushState(){restored++}}},
    confirm:()=>false,addEventListener(name,fn){listeners.set(name,fn)},removeEventListener(name){listeners.delete(name)}}
  const hooks=load('lib/assessments/useStrengthDraft.ts',{react:{useEffect(fn){effects.push(fn)}},'./strengthHistoryGuard':{registerStrengthHistoryGuard(fn){guard=fn;return()=>{guard=null}}}},
    {window:browser,document:{addEventListener(name,fn){documentListeners.set(name,fn)},removeEventListener(name){documentListeners.delete(name)}}})
  let state={unsaved:true,saving:false,submitting:false,values:{weight:'152'}}
  hooks.useUnsavedAssessmentGuard({getSnapshot:()=>state});const cleanup=effects.pop()()
  const event=()=>({prevented:false,stopped:false,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}})
  const back=event();guard(back);assert.equal(back.stopped,true);assert.equal(restored,1)
  const unload=event();listeners.get('beforeunload')(unload);assert.equal(unload.prevented,true)
  const logout=event();listeners.get('anastasis:before-assessment-navigation')(logout);assert.equal(logout.prevented,true)
  assert.equal(state.values.weight,'152')
  state={...state,unsaved:false};const saved=event();listeners.get('anastasis:before-assessment-navigation')(saved);assert.equal(saved.prevented,false)
  cleanup();assert.equal(listeners.size,0);assert.equal(documentListeners.size,0)
})

test('all logout controls dispatch the guard before authentication and retain analytics reset; the shell mounts history protection early',()=>{
  for(const [path,operation] of [['components/AuthButton.tsx','const supabase = createClient()'],['components/account/LogoutButton.tsx',"await fetch('/api/auth/logout'"],['components/navigation/DashboardMoreMenu.tsx',"await fetch('/api/auth/logout'"]]){
    const source=readFileSync(path,'utf8'),handler=source.slice(source.indexOf(path.includes('AuthButton')?'async function handleLogout':'async function logout'))
    assert.match(handler,/dispatchEvent\(new Event\('anastasis:before-assessment-navigation', \{ cancelable: true \}\)\)\) return/)
    assert.ok(handler.indexOf('anastasis:before-assessment-navigation')<handler.indexOf(operation))
    assert.ok(handler.indexOf('resetAnalyticsIdentity()')>handler.indexOf(operation))
  }
  const layout=readFileSync('app/layout.tsx','utf8')
  assert.ok(layout.indexOf('<StrengthHistoryGuardRoot />')<layout.indexOf('<AuthButton />'))
  assert.match(readFileSync('components/assessments/StrengthHistoryGuardRoot.tsx','utf8'),/useLayoutEffect\(acquireStrengthHistoryGuard/)
  assert.doesNotMatch(readFileSync('lib/assessments/strengthDraftSession.ts','utf8'),/localStorage|sessionStorage|indexedDB/)
})

test('the shared history listener stays ahead of later router handling and releases only after the last consumer',()=>{
  const previous=globalThis.window,listeners=[];let removed=0,routerCalls=0,guardCalls=0
  globalThis.window={addEventListener(name,fn,capture){listeners.push({name,fn,capture})},removeEventListener(name,fn,capture){const index=listeners.findIndex(listener=>listener.name===name&&listener.fn===fn&&listener.capture===capture);if(index>=0){listeners.splice(index,1);removed++}}}
  try{
    const releaseShell=historyGuard.acquireStrengthHistoryGuard()
    listeners.push({name:'popstate',capture:false,fn(){routerCalls++}})
    const releasePage=historyGuard.registerStrengthHistoryGuard(event=>{guardCalls++;event.stopImmediatePropagation()})
    assert.equal(listeners.filter(listener=>listener.capture===true).length,1)
    const event={cancelBubble:false,stopImmediatePropagation(){this.cancelBubble=true}}
    for(const listener of [...listeners].sort((a,b)=>Number(b.capture)-Number(a.capture))){listener.fn(event);if(event.cancelBubble)break}
    assert.equal(guardCalls,1);assert.equal(routerCalls,0)
    releasePage();assert.equal(removed,0)
    releaseShell();assert.equal(removed,1)
    releaseShell();assert.equal(removed,1)
  }finally{globalThis.window=previous}
})
