import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { webcrypto } from 'node:crypto'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const privacy=await importTs('lib/analytics/privacy.ts')
const require=createRequire(import.meta.url)
const fixed={page:'landing',experiment_id:'homepage_storytelling_v1',homepage_version:'storytelling_v1'}
const environment={analytics_environment:'test',analytics_schema:1}
const plain=value=>JSON.parse(JSON.stringify(value))
const sectionEvents=['homepage_story_section_viewed','homepage_founder_section_viewed','homepage_community_section_viewed']
const placements=['features','final_cta','outcome','how_it_works','for_you','story','founder','community','programs','navigation','footer']
const tick=()=>new Promise(resolve=>setImmediate(resolve))

function harness({accepted=true,key=true,owner=null}={}){
  const values=new Map(accepted?[['cookie_consent','accepted']]:[]),timers=[],captures=[],initialized=[]
  if(owner){values.set('anastasis:analytics-journey-owner:v1',owner);values.set('anastasis:analytics-anonymous:v1','anonymous_11111111-1111-4111-8111-111111111111')}
  const browser={localStorage:{getItem:name=>values.get(name)??null,setItem:(name,value)=>values.set(name,value),removeItem:name=>values.delete(name)},
    location:{protocol:'https:'},setTimeout(fn){timers.push(fn)},requestIdleCallback(fn){timers.push(fn)},dispatchEvent(){}}
  const globals={window:browser,document:{cookie:''},crypto:webcrypto,TextEncoder,URL,Date,Event:class Event{},process:{env:{...(key?{NEXT_PUBLIC_POSTHOG_KEY:'synthetic-homepage-key'}:{})}}}
  let mode='accept'
  const sdk={init(_key,options){initialized.push(options)},stopSessionRecording(){},reset(){},opt_in_capturing(){},opt_out_capturing(){},
    capture(event,properties){
      if(mode==='throw')throw new Error('Synthetic optional SDK failure')
      if(mode==='drop')return undefined
      const result=initialized.at(-1).before_send({uuid:webcrypto.randomUUID(),event,timestamp:new Date('2026-11-01T12:00:00Z'),properties:{...properties,
        distinct_id:'caller-identity',journey_id:'caller-journey',member_id:'caller-member',$current_url:'https://app.test/?token=secret#email',
        $referrer:'https://private.test/?email=private@example.test',email:'private@example.test',capacity_score:98,recommendation_category:'cycle_support',payment_status:'paid',answers:{pain:true}},$set:{email:'private@example.test'}})
      if(result)captures.push(plain(result))
      return result||undefined
    }}
  const load=(path,mocks)=>{
    const module={exports:{}}
    const output=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
    runInNewContext(output,{...globals,module,exports:module.exports,require:name=>mocks[name]||require(name)})
    return module.exports
  }
  const consent=load('lib/analytics/consent.ts',{})
  const sdkModule=load('lib/posthog.ts',{'@/lib/analytics/consent':consent,'@/lib/analytics/privacy':{...privacy,filterAnalyticsEvent:(event,properties)=>privacy.filterAnalyticsEvent(event,properties,'test')},'posthog-js':{__esModule:true,default:sdk}})
  const analytics=load('lib/analytics.ts',{'@/lib/posthog':{__esModule:true,default:sdkModule.default}})
  return{api:sdkModule,trackEvent:analytics.trackEvent,captures,initialized,values,setMode(value){mode=value},async flush(){while(timers.length)timers.shift()();await tick();await tick()}}
}

test('homepage section and landing schemas retain only their exact fixed experiment context',()=>{
  for(const event of ['landing_page_viewed',...sectionEvents]){
    assert.deepEqual(privacy.filterAnalyticsEvent(event,{...fixed,email:'private@example.test',program:'all',source:'cycle_support'},'test'),{event,properties:{...environment,...fixed}})
    assert.deepEqual(privacy.filterAnalyticsEvent(event,{page:'about',experiment_id:'unapproved',homepage_version:'other',location:'story?email=private@example.test'},'test').properties,environment)
  }
})

test('homepage program CTA permits all only for its own event and accepts only bounded placements',()=>{
  for(const program of ['ember','ignite','phoenix','all'])for(const location of placements){
    assert.deepEqual(privacy.filterAnalyticsEvent('homepage_program_cta_clicked',{...fixed,program,location,cta_location:location},'test').properties,{...environment,...fixed,program,location,cta_location:location})
  }
  const unsafe=privacy.filterAnalyticsEvent('homepage_program_cta_clicked',{...fixed,program:'tracker',location:'hero',cta_location:'private@example.test',tier:'phoenix',href:'/program/phoenix?token=secret'},'test')
  assert.deepEqual(unsafe.properties,{...environment,...fixed})
  assert.equal(privacy.filterAnalyticsEvent('program_viewed',{program:'all'},'test').properties.program,undefined)
  assert.equal(privacy.filterAnalyticsEvent('today_page_viewed',{tier:'all'},'test').properties.tier,undefined)
})

test('audit CTA placements match their event while the existing about CTA schema is preserved',()=>{
  for(const [event,location]of[['audit_cta_clicked_1','hero'],['audit_cta_clicked_2','outcome'],['audit_cta_clicked_3','final_cta']]){
    assert.deepEqual(privacy.filterAnalyticsEvent(event,{...fixed,location,cta_location:location},'test').properties,{...environment,...fixed,location,cta_location:location})
    assert.deepEqual(privacy.filterAnalyticsEvent(event,{...fixed,location:'founder',cta_location:'footer'},'test').properties,{...environment,...fixed})
  }
  assert.deepEqual(privacy.filterAnalyticsEvent('audit_cta_clicked_about',{page:'about',source:'about',experiment_id:fixed.experiment_id,homepage_version:fixed.homepage_version},'test').properties,{...environment,page:'about',source:'about'})
})

test('actual SDK wire scrubbing preserves homepage metadata and removes malicious automatic or caller properties',async()=>{
  const app=harness()
  assert.equal(app.trackEvent('landing_page_viewed',fixed),true,'True means the bounded local queue accepted the event.')
  await app.flush()
  assert.equal(app.captures.length,1)
  assert.equal(app.trackEvent('homepage_program_cta_clicked',{...fixed,program:'all',location:'features',cta_location:'features',email:'private@example.test'}),true)
  for(const capture of app.captures){
    assert.equal(capture.properties.experiment_id,fixed.experiment_id)
    assert.equal(capture.properties.homepage_version,fixed.homepage_version)
    assert.match(capture.properties.distinct_id,/^anonymous_[0-9a-f-]{36}$/)
    assert.equal(capture.properties.distinct_id,capture.properties.journey_id)
    assert.equal(capture.properties.$process_person_profile,false)
    assert.equal(capture.properties.$geoip_disable,true)
    assert.equal(capture.$set,undefined)
    assert.doesNotMatch(JSON.stringify(capture),/private@example|caller-|token=|capacity|cycle_support|payment_status|answers|current_url|referrer/)
  }
  assert.equal(app.captures.at(-1).properties.program,'all')
  app.setMode('drop');assert.equal(app.trackEvent('homepage_story_section_viewed',fixed),false)
  app.setMode('throw');assert.equal(app.trackEvent('homepage_founder_section_viewed',fixed),false)
})

test('boolean acceptance fails closed for consent, pending owned auth, missing key, unknown events and queue exhaustion',async()=>{
  for(const options of [{accepted:false},{key:false},{owner:'member_'+ 'a'.repeat(64)}]){
    const app=harness(options)
    assert.equal(app.trackEvent('landing_page_viewed',fixed),false)
    await app.flush()
    assert.equal(app.captures.length,0);assert.equal(app.initialized.length,0)
  }
  const app=harness()
  assert.equal(app.trackEvent('not_an_approved_event',fixed),false)
  assert.equal(app.trackEvent('subscription_activated',{tier:'phoenix'}),false)
  for(let index=0;index<50;index++)assert.equal(app.trackEvent('homepage_story_section_viewed',fixed),true)
  assert.equal(app.trackEvent('homepage_founder_section_viewed',fixed),false,'A full queue does not evict an already accepted event.')
  await app.flush()
  assert.equal(app.captures.length,50)
  assert.ok(app.captures.every(event=>event.event==='homepage_story_section_viewed'))
})
