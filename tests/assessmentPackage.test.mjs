import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const strength = await importTs('lib/assessment/strengthForm.ts')
const hub = await importTs('lib/assessment/assessmentHub.ts')
const photos = await importTs('lib/assessment/photoComparison.ts')
const recognition = await importTs('lib/assessment/getStrengthAssessmentStatus.ts')
const entitlements = await importTs('lib/entitlements.ts')
const memberSelections = await importTs('lib/assessment/memberSelections.ts')
const {memberAssessmentStatusFromRecords} = await importTs('lib/assessment/getMonthlyAssessmentStatus.ts')
const owner = { client_id: 'fixture-client', auth_user_id: 'fixture-user', timezone: 'UTC', birthdate: '1990-06-15', program: 'ember' }
const now = new Date('2026-10-27T12:00:00Z')
const clone = value => structuredClone(value)
function database(tables = {}, failed = []) {
  const original = clone(tables), rows = clone(tables), reads = [], signed = []
  const db = { reads, signed, from(table) {
    assert.ok(['assessments', 'body_assessment_sessions', 'assessment_photos'].includes(table), 'Only existing final-record tables may be read')
    const filters = [], orders = []; let maximum
    const read = { table, filters, orders }; reads.push(read)
    const q = {
      select() { return q }, eq(key,value) { filters.push(['eq',key,value]); return q },
      neq(key,value) { filters.push(['neq',key,value]); return q },
      or(value) { assert.equal(value,'source.is.null,source.neq.monthly-review');filters.push(['sourceFilter']);return q },
      in(key,value) { filters.push(['in',key,value]); return q },
      lte(key,value) { filters.push(['lte',key,value]); return q },
      gte(key,value) { filters.push(['gte',key,value]); return q },
      lt(key,value) { filters.push(['lt',key,value]); return q },
      order(key,{ascending}) { orders.push([key,ascending]); return q }, limit(value) { maximum=value; return q },
      maybeSingle() { return Promise.resolve(result(true)) }, then(done) { return Promise.resolve(result(false)).then(done) },
    }
    function result(single) {
      if (failed.includes(table)) return { data:null, error:{message:'Fixture unavailable'} }
      const selected=(rows[table] || []).filter(row=>filters.every(([op,key,value])=>op==='sourceFilter'?row.source==null||row.source!=='monthly-review':op==='eq'?row[key]===value:op==='neq'?row[key]!==value:op==='in'?value.includes(row[key]):row[key] != null && (op==='lte'?row[key]<=value:op==='gte'?row[key]>=value:row[key]<value)))
        .sort((a,b)=>{for(const[key,ascending]of orders){if(a[key]!==b[key]) return (a[key]<b[key]?-1:1)*(ascending?1:-1)}return 0}).slice(0,maximum)
      return { data: single ? selected[0] || null : selected, error:null }
    }
    return q
  }, storage: { from(bucket) { assert.equal(bucket,'assessment_photos'); return { async createSignedUrl(path,seconds) { signed.push(path); assert.equal(seconds,1800);return {data:{signedUrl:`https://fixture.invalid/${path}`},error:null} } } } },
    verify() { assert.deepEqual(rows,original,'Readers must not modify saved records');for(const read of reads){assert.ok(read.filters.some(([op,key,value])=>op==='eq'&&key==='client_id'&&value===owner.client_id));assert.ok(read.filters.some(([op,key,value])=>op==='eq'&&key===(read.table==='body_assessment_sessions'?'user_id':'auth_user_id')&&value===owner.auth_user_id))} },
  }
  return db
}
const final = (overrides={}) => ({id:'final',client_id:owner.client_id,auth_user_id:owner.auth_user_id,assessment_type:'strength',submitted_at:'2026-09-15T12:00:00Z',data:{height_in:65,shoulder_press_weight:0,shoulder_press_reps:12,plank_time:41},...overrides})

test('Strength reads the latest owned final, excludes foreign/future records and never loads draft sessions',async()=>{
  const db=database({assessments:[final(),final({id:'other',auth_user_id:'other-user',submitted_at:'2026-10-20T12:00:00Z'}),final({id:'future',submitted_at:'2026-11-01T12:00:00Z'}),final({id:'wrong-type',assessment_type:'monthly',submitted_at:'2026-10-21T12:00:00Z'})],strength_assessment_sessions:[{status:'draft',data:{shoulder_press_weight:999}}]})
  const history=await strength.getStrengthFormHistory(db,owner,now)
  assert.equal(history.completedAt,'2026-09-15T12:00:00Z');assert.equal(history.values.shoulder_press_weight,'0');assert.equal(history.values.plank_time,'41');assert.equal(history.unavailable,false)
  const defaults=strength.strengthFormDefaults(owner,history)
  assert.equal(defaults.birthdate,owner.birthdate);assert.equal(defaults.height_in,'65')
  assert.equal(defaults.weight,'');assert.equal(defaults.plank_time,'')
  for(const[key]of strength.strengthMovements)for(const kind of ['weight','reps'])assert.equal(defaults[`${key}_${kind}`],'')
  assert.equal(strength.strengthFormDefaults({...owner,height_in:67},history).height_in,'67');db.verify()
})

test('missing, failed or malformed history stays honest and never becomes zero performance',async()=>{
  const empty=database();assert.deepEqual(await strength.getStrengthFormHistory(empty,owner,now),{completedAt:null,values:{},unavailable:false});empty.verify()
  const failed=database({},['assessments']);assert.equal((await strength.getStrengthFormHistory(failed,owner,now)).unavailable,true);failed.verify()
  const draft=database({assessments:[final({data:{status:'draft',shoulder_press_weight:99}})]});assert.equal((await strength.getStrengthFormHistory(draft,owner,now)).unavailable,true);draft.verify()
  const noIdentity=database();assert.equal((await strength.getStrengthFormHistory(noIdentity,{client_id:owner.client_id},now)).unavailable,true);assert.equal(noIdentity.reads.length,0)
})

const answers={execution_style:'flow',carousel_style:'section',wake_time:'07:00',bed_time:'22:00',workout_days_available:0}
const reviewed={...owner,onboarding_data:{scheduleStructureAssessments:{'1':{'standalone:2026-10':{assessmentVersion:1,eventId:'schedule-structure:2026-10',submittedAt:'2026-10-01T12:00:00Z',answers}}}}}
const completeStrength=recognition.strengthAssessmentStatusFromRecords({period:'2026-10-01',assessment:{id:'final',submitted_at:'2026-10-01T12:00:00Z'}})
const bodyRow=(type,date)=>({assessment_type:type,status:'completed',completed_at:date+'T12:00:00Z'})
function build(overrides={}) { return hub.buildAssessmentHub({client:reviewed,today:'2026-10-27',now,monthly:memberAssessmentStatusFromRecords({client:owner,full:{submitted_at:'2026-10-01T12:00:00Z'},review:null,now}),strength:completeStrength,body:{data:[bodyRow('monthly','2026-10-01'),bodyRow('structural','2026-08-01')]},...overrides}) }

test('due filtering excludes completed/not-yet-due items and optional photos',()=>{
  const status=build();assert.deepEqual(status.due,[]);assert.deepEqual(status.unavailable,[])
  const all=build({client:owner,monthly:memberAssessmentStatusFromRecords({client:owner,full:null,review:null,now}),strength:recognition.strengthAssessmentStatusFromRecords({period:'2026-10-01'}),body:{data:[]}})
  assert.deepEqual(all.due.map(row=>row.id),['member','strength','structure','measurements']);assert.equal(all.due.filter(row=>row.id==='measurements').length,1)
  assert.ok(!all.due.some(row=>row.title.includes('Photo')))
})

test('body 1/9-calendar-month cadence stays separate from Strength calendar month and the independent quarterly/review cadence',()=>{
  const body=build({body:{data:[bodyRow('monthly','2026-09-27'),bodyRow('structural','2026-01-27')]}})
  assert.equal(body.due.length,1);assert.equal(body.due[0].title,'Body & Structural Measurements')
  assert.equal(build({body:{data:[bodyRow('monthly','2026-10-01'),bodyRow('structural','2026-01-27')]}}).due[0].title,'Structural Measurements')
  assert.equal(build({body:{data:[bodyRow('monthly','2026-09-27'),bodyRow('structural','2026-08-01')]}}).due[0].title,'Body Measurements')
  const strengthOnly=build({strength:recognition.strengthAssessmentStatusFromRecords({period:'2026-10-01'})});assert.deepEqual(strengthOnly.due.map(row=>row.id),['strength'])
  const unavailable=build({monthly:memberAssessmentStatusFromRecords({client:owner,full:null,review:null,now,unavailable:true}),body:{data:null,error:true}});assert.equal(unavailable.due.length,0);assert.deepEqual(unavailable.unavailable,['Member assessment','Body measurements'])
})

test('hub queries enforce member ownership and use independent latest completions without writes',async()=>{
  const db=database({assessments:[final({submitted_at:'2026-10-01T12:00:00Z'}),final({assessment_type:'monthly',submitted_at:'2026-10-01T12:00:00Z'})],body_assessment_sessions:[{...bodyRow('full','2026-10-01'),client_id:owner.client_id,user_id:owner.auth_user_id},{...bodyRow('full','2026-10-25'),client_id:owner.client_id,user_id:'other-user'}]})
  const status=await hub.getAssessmentHub(db,reviewed,now);assert.deepEqual(status.due,[]);db.verify()
})

const photo=(id,date,views={},overrides={})=>({id,uploaded_at:date+'T12:00:00Z',client_id:owner.client_id,auth_user_id:owner.auth_user_id,assessment_type:'progress',...Object.fromEntries(Object.entries(views).map(([key,value])=>[`${key}_photo_url`,`${owner.client_id}/${id}/${value}`])),...overrides})
test('photo comparison uses the actual first/latest whole sets and matching same side, excluding posture/foreign/future sets',async()=>{
  const db=database({assessment_photos:[photo('first','2025-01-01',{front:'front.jpg',right:'right.jpg'}),...Array.from({length:20},(_,i)=>photo('mid'+i,'2026-09-01',{front:'mid.jpg'})),photo('last','2026-10-25',{front:'front.jpg',right:'right.jpg'}),photo('posture','2026-10-26',{left:'left.jpg'},{assessment_type:'posture'}),photo('foreign','2026-10-26',{front:'front.jpg'},{auth_user_id:'other'}),photo('future','2026-11-01',{front:'front.jpg'})]})
  const comparison=await photos.getProgressPhotoComparison(db,owner,now)
  assert.equal(comparison.first.id,'first');assert.equal(comparison.latest.id,'last');assert.equal(comparison.side,'right');assert.equal(comparison.first.date,'2025-01-01T12:00:00Z')
  assert.ok(Object.values(comparison.first.views).every(url=>url.includes('/first/')));assert.ok(Object.values(comparison.latest.views).every(url=>url.includes('/last/')));db.verify()
})

test('missing angles are never filled from another set or opposite side; one set is not duplicated',async()=>{
  const db=database({assessment_photos:[photo('first','2026-01-01',{front:'front.jpg',left:'left.jpg'}),photo('last','2026-10-25',{right:'right.jpg'})]})
  const result=await photos.getProgressPhotoComparison(db,owner,now);assert.equal(result.side,'left');assert.equal(result.latest.views.left,undefined);assert.equal(result.latest.views.front,undefined);db.verify()
  const one=database({assessment_photos:[photo('only','2026-01-01',{front:'front.jpg'})]});assert.equal((await photos.getProgressPhotoComparison(one,owner,now)).latest,null);one.verify()
  const failed=database({},['assessment_photos']);assert.equal((await photos.getProgressPhotoComparison(failed,owner,now)).unavailable,true);failed.verify()
  const empty=database();assert.equal((await photos.getProgressPhotoComparison(empty,owner,now)).first,null);empty.verify()
})

const require=createRequire(import.meta.url),React=require('react')
function loadUI(path,mocks={},globals={}) {
  const module={exports:{}}
  const {outputText}=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}})
  runInNewContext(outputText,{module,exports:module.exports,...globals,require:name=>name.endsWith('.css')?{}:mocks[name]||require(name)})
  return module.exports.default
}
const nodes=(tree,predicate)=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(child=>nodes(child,predicate)):[...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)]
function harness(path,props) {
  let index=0;const states=[],calls=[],storage=new Map();const window={location:{href:''}}
  const Component=loadUI(path,{
    react:{useState(initial){const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>states[i]=typeof value==='function'?value(states[i]):value]},useRef:value=>({current:value}),useEffect(){}},
    'next/link':({children})=>children,'@/components/phone-app/PhoneAppFrame':({children})=>children,
    '@/lib/assessment/strengthForm':strength,'@/lib/assessment/memberSelections':memberSelections,'@/lib/entitlements':entitlements,
    '@/components/AssessmentPhotoUpload':()=>null,'@/app/styles/globalstyles':{},
  },{window,localStorage:{removeItem:key=>storage.delete(key)},console,fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json({success:true,redirect:'/dashboard/assessment/monthly'})}})
  return {render(){index=0;return Component(props)},calls,window}
}
test('Strength UI shows individual prior results while submissions retain blank untested movements',async()=>{
  const history={completedAt:'2026-09-15T12:00:00Z',values:{height_in:'65',shoulder_press_weight:'0',shoulder_press_reps:'12',plank_time:'41'},unavailable:false}
  const view=harness('app/dashboard/assessment/start2/Start2Content.tsx',{client:owner,history})
  const inputs=nodes(view.render(),node=>node.type==='input')
  assert.equal(inputs.find(node=>node.props.name==='birthdate').props.value,owner.birthdate)
  assert.equal(inputs.find(node=>node.props.name==='height_in').props.value,'65')
  assert.equal(inputs.find(node=>node.props.name==='shoulder_press_weight').props.value,'')
  assert.equal(nodes(view.render(),node=>node.props?.id==='shoulder_press_weight-last')[0].props.children,'Last: 0 lb')
  assert.equal(nodes(view.render(),node=>node.props?.id==='plank-last')[0].props.children,'Last: 41 seconds')
  const change=(name,value)=>nodes(view.render(),node=>node.type==='input'&&node.props.name===name)[0].props.onChange({target:{name,value}})
  change('weight','140');change('shoulder_press_weight','10');change('shoulder_press_reps','8')
  await nodes(view.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}})
  assert.equal(view.calls[0].url,'/api/assessment-strength');assert.equal(view.calls[0].body.shoulder_press_weight,'10');assert.equal(view.calls[0].body.bench_press_weight,'');assert.equal(view.calls[0].body.plank_time,'')
})

test('measurement layout keeps all standard/advanced fields, entered values, notes and existing save payload',async()=>{
  const view=harness('components/MeasurementAssessment.tsx',{clientId:owner.client_id})
  let tree=view.render(),inputs=nodes(tree,node=>node.type==='input')
  const standard=inputs.filter(node=>node.props.type==='number');assert.equal(standard.length,15)
  standard.find(node=>node.props.id==='measurement-waist').props.onChange({target:{value:'31.25'}})
  inputs.find(node=>node.props.type==='checkbox').props.onChange({target:{checked:true}})
  tree=view.render();inputs=nodes(tree,node=>node.type==='input')
  assert.equal(inputs.filter(node=>node.props.type==='number').length,43)
  inputs.find(node=>node.props.id==='measurement-torso_length').props.onChange({target:{value:'18'}})
  nodes(tree,node=>node.type==='textarea')[0].props.onChange({target:{value:'Fixture note'}})
  await nodes(view.render(),node=>node.type==='button'&&node.props.className==='assessment-action')[0].props.onClick()
  assert.equal(view.calls[0].url,'/api/measurements');assert.equal(view.calls[0].body.advanced_enabled,true);assert.deepEqual(view.calls[0].body.measurements,{waist:31.25,torso_length:18});assert.equal(view.calls[0].body.notes,'Fixture note')
})

test('sectioned member form retains required choices, notes, profile values and its existing submit route',async()=>{
  const view=harness('app/dashboard/assessment/start/StartContent.tsx',{client:{...owner,full_name:'Fixture Member',email:'fixture@example.invalid'},assessmentType:'quarterly'})
  const required={trainingDays:'3',experienceLevel:'consistent',equipmentAccess:'commercial-gym',primaryFocus:'strength',currentLimitations:'none',recoveryCapacity:'moderate',sleepQuality:'decent',stressLevel:'low',cardioPreference:'walking',notes:'Fixture note'}
  for(const[name,value]of Object.entries(required)){
    const field=nodes(view.render(),node=>['select','textarea'].includes(node.type)&&node.props.name===name)[0]
    assert.ok(field,`Existing field ${name} is retained`);field.props.onChange({target:{name,value}})
  }
  await nodes(view.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}})
  assert.equal(view.calls[0].url,'/api/assessment');assert.equal(view.calls[0].body.assessmentType,'quarterly');assert.equal(view.calls[0].body.birthdate,owner.birthdate);assert.equal(view.calls[0].body.fullName,'Fixture Member')
  for(const[name,value]of Object.entries(required))assert.equal(view.calls[0].body[name],value)
  assert.equal(view.window.location.href,'/dashboard/assessment/monthly')
})

const treeText=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(treeText).join(' '):tree&&typeof tree==='object'?treeText(tree.props?.children):''
test('due-only hub renders the exact empty state, hides unknown completion and keeps library access',async()=>{
  let status={due:[],unavailable:[]}
  const Page=loadUI('app/dashboard/assessment/monthly/page.tsx',{
    'next/link':({children})=>children,'@/components/phone-app/PhoneAppFrame':{default:({children})=>children,PhoneAppCard:()=>null,__esModule:true},
    '@/lib/dashboard/getDashboardContext':{getDashboardContext:async()=>({client:owner,supabase:{}})},
    '@/lib/assessment/assessmentHub':{getAssessmentHub:async()=>status},
  })
  let tree=await Page(),text=treeText(tree);assert.match(text,/You’re up to date\./);assert.doesNotMatch(text,/Coming up|Completed This Month/)
  assert.ok(nodes(tree,node=>node.props?.href==='/dashboard/assessment').length)
  status={due:[],unavailable:['Strength assessment']};text=treeText(await Page());assert.doesNotMatch(text,/You’re up to date/);assert.match(text,/couldn’t confirm/)
})

test('photo cards keep front and the exact selected side in both columns and show missing/one-set states',()=>{
  const Component=loadUI('components/ProgressPhotoComparison.tsx',{'next/image':()=>null})
  const first={id:'first',date:'2026-01-01T12:00:00Z',type:'progress',views:{front:'fixture-front',left:'fixture-left'}},latest={id:'last',date:'2026-10-25T12:00:00Z',type:'progress',views:{right:'fixture-right'}}
  const tree=Component({comparison:{first,latest,side:'left',unavailable:false}})
  assert.deepEqual(nodes(tree,node=>node.props?.view).map(node=>node.props.view),['front','left','front','left'])
  assert.match(treeText(Component({comparison:{first,latest:null,side:'left',unavailable:false}})),/One set saved/)
  assert.match(treeText(Component({comparison:{first:null,latest:null,side:'left',unavailable:true}})),/could not be loaded/)
})

test('Monthly Review shows saved choices, edits one section and confirms without resetting untouched values',async()=>{
  const savedAnswers={trainingDays:'3',experienceLevel:'consistent',equipmentAccess:'commercial-gym',primaryFocus:'strength',currentLimitations:'none',recoveryCapacity:'moderate',sleepQuality:'decent',stressLevel:'low',cardioPreference:'walking',notes:'Saved note'}
  const view=harness('app/dashboard/assessment/start/StartContent.tsx',{client:owner,assessmentType:'review',savedAnswers,draftVersion:'fixture-cycle'})
  assert.match(treeText(view.render()),/3 days/);assert.match(treeText(view.render()),/Consistent lifter/)
  assert.equal(nodes(view.render(),node=>node.type==='select').length,0)
  const training=nodes(view.render(),node=>node.type==='fieldset')[0]
  nodes(training,node=>node.type==='button')[0].props.onClick()
  assert.equal(nodes(view.render(),node=>node.type==='select').length,3)
  nodes(view.render(),node=>node.type==='select'&&node.props.name==='trainingDays')[0].props.onChange({target:{name:'trainingDays',value:'4'}})
  await nodes(view.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}})
  assert.equal(view.calls[0].body.assessmentType,'review');assert.equal(view.calls[0].body.trainingDays,'4')
  for(const key of ['sleepQuality','stressLevel','cardioPreference','notes'])assert.equal(view.calls[0].body[key],savedAnswers[key])
  const readonly=harness('app/dashboard/assessment/start/StartContent.tsx',{client:owner,assessmentType:'review',savedAnswers,canSubmit:false})
  assert.equal(nodes(readonly.render(),node=>node.type==='button'&&node.props.type==='submit').length,0)
  await nodes(readonly.render(),node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});assert.equal(readonly.calls.length,0)
})
