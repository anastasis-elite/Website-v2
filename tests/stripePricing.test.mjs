import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require=createRequire(import.meta.url)
function load(path,mocks={}) {
  const module={exports:{}}
  const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  vm.runInNewContext(source,{module,exports:module.exports,require:name=>name==='server-only'?{}:mocks[name]??require(name),process,globalThis,Intl,URL,Response},{filename:path})
  return module.exports
}
class StripeMock {
  constructor(secret) {
    globalThis.pricingSecretsSeen.push(secret)
    this.prices={retrieve:async(id,options)=>{globalThis.pricingRetrievals.push({id,options});const value=globalThis.pricingObjects[id];if(value instanceof Error)throw value;if(!value)throw new Error('Unconfigured provider ID');return value}}
  }
}
const catalog=load('lib/commerce/catalog.ts')
const { getPrice, parseProgram, parseBilling, publicPriceDetails } = catalog
const route=load('app/api/pricing/route.ts',{'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},stripe:StripeMock,'@/lib/commerce/catalog':catalog})
const variables=['STRIPE_SECRET_KEY','EMBER_SUB_PRICE','EMBER_YEAR_PRICE','IGNITE_SUB_PRICE','IGNITE_YEAR_PRICE','PHOENIX_SUB_PRICE','PHOENIX_YEAR_PRICE']
async function configured(run) {
  const original=Object.fromEntries(variables.map(key=>[key,process.env[key]]))
  for(const key of variables) delete process.env[key]
  Object.assign(process.env,{STRIPE_SECRET_KEY:'sk_test_mock_only',EMBER_SUB_PRICE:'price_EmberMonthly',EMBER_YEAR_PRICE:'price_EmberFull'})
  globalThis.pricingRetrievals=[];globalThis.pricingSecretsSeen=[];globalThis.pricingObjects={}
  try {await run()} finally {for(const key of variables) {if(original[key]===undefined) delete process.env[key];else process.env[key]=original[key]}}
}
function price(billing='subscription',overrides={}) {
  return {id:billing==='subscription'?'price_EmberMonthly':'price_EmberFull',object:'price',active:true,billing_scheme:'per_unit',currency:'usd',unit_amount:billing==='subscription'?36000:360000,custom_unit_amount:null,transform_quantity:null,metadata:{program:'ember'},type:billing==='subscription'?'recurring':'one_time',recurring:billing==='subscription'?{interval:'month',interval_count:1,usage_type:'licensed'}:null,product:{id:'prod_Ember',object:'product',active:true,metadata:{program:'ember'}},...overrides}
}
const stripe = value => ({prices:{retrieve:async(id,options)=>{assert.equal(id,value.id);assert.equal(JSON.stringify(options),JSON.stringify({expand:['product']}));return value}}})
const request = program=>new Request(`https://local-test.invalid/api/pricing?program=${program}`)

test('configured Stripe amount and month interval are shown; one-time amount remains visible without an invented access period',()=>configured(async()=>{
  const monthly=await getPrice(stripe(price()),'ember','subscription')
  assert.equal(monthly.details.available,true);assert.equal(monthly.details.amount,360);assert.equal(monthly.details.currency,'USD');assert.match(monthly.details.amountLabel,/360/);assert.equal(monthly.details.intervalLabel,'per month')
  const full=await getPrice(stripe(price('annual')),'ember','annual')
  assert.equal(full.details.amount,3600);assert.equal(full.details.available,false);assert.equal(full.details.intervalLabel,'one-time payment');assert.equal(full.details.accessMonths,undefined)
  assert.match(full.details.coverageLabel,/not been confirmed/);assert.doesNotMatch(full.details.coverageLabel,/12|year|savings/i)
}))

test('one-time access duration comes only from explicit positive integer Stripe metadata, with price-specific override',()=>configured(async()=>{
  const value=price('annual');value.product.metadata.access_months='12'
  let result=await getPrice(stripe(value),'ember','annual')
  assert.equal(result.details.available,true);assert.equal(result.details.accessMonths,12);assert.equal(result.details.coverageLabel,'Includes 12 months of program access.')
  value.metadata.access_months='6';result=await getPrice(stripe(value),'ember','annual');assert.equal(result.details.accessMonths,6)
  for(const invalid of ['0','-3','12.0','one year','3.5','121','999999999999999999999']) {
    value.metadata.access_months=invalid;result=await getPrice(stripe(value),'ember','annual');assert.equal(result.details.available,false);assert.equal(result.details.accessMonths,undefined)
  }
}))

test('actual recurring intervals stay visible while incompatible monthly/pay-in-full mappings cannot open checkout',()=>configured(async()=>{
  const yearly=price('subscription',{recurring:{interval:'year',interval_count:1,usage_type:'licensed'}})
  const result=await getPrice(stripe(yearly),'ember','subscription');assert.equal(result.details.available,false);assert.equal(result.details.intervalLabel,'per year')
  const everyTwoMonths=price('subscription',{recurring:{interval:'month',interval_count:2,usage_type:'licensed'}})
  assert.equal((await getPrice(stripe(everyTwoMonths),'ember','subscription')).details.intervalLabel,'every 2 months')
  const recurringFull=price('annual',{type:'recurring',recurring:{interval:'year',interval_count:1,usage_type:'licensed'}})
  assert.equal((await getPrice(stripe(recurringFull),'ember','annual')).details.available,false)
}))

test('program metadata mismatch and ambiguous tier mappings fail before advertising a different tier price',()=>configured(async()=>{
  const mismatch=price('subscription',{metadata:{program:'ignite'}})
  const wrong=await getPrice(stripe(mismatch),'ember','subscription');assert.equal(wrong.details.available,false);assert.equal(wrong.details.amount,undefined)
  const mapped=price('subscription',{metadata:{},product:{id:'prod_Mapped',active:true,metadata:{}}})
  assert.equal((await getPrice(stripe(mapped),'ember','subscription')).details.available,true)
  process.env.IGNITE_SUB_PRICE=mapped.id
  assert.equal((await getPrice(stripe(mapped),'ember','subscription')).details.available,false)
  const deleted=price('subscription',{product:{id:'prod_Deleted',deleted:true}})
  assert.equal((await getPrice(stripe(deleted),'ember','subscription')).details.available,false)
}))

test('inactive, variable, metered and unavailable fixed-price configurations disable purchasing',()=>configured(async()=>{
  for(const overrides of [{active:false},{product:{id:'prod_Ember',active:false,metadata:{program:'ember'}}},{billing_scheme:'tiered'},{custom_unit_amount:{enabled:true}},{transform_quantity:{divide_by:2,round:'up'}},{recurring:{interval:'month',interval_count:1,usage_type:'metered'}},{unit_amount:null},{unit_amount:-1}]) {
    const value=price('subscription',overrides)
    assert.equal((await getPrice(stripe(value),'ember','subscription')).details.available,false)
  }
}))

test('currency amounts preserve Stripe minor units including zero- and three-decimal currencies',()=>configured(async()=>{
  const yen=await getPrice(stripe(price('subscription',{currency:'jpy',unit_amount:36000})),'ember','subscription')
  assert.equal(yen.details.amount,36000);assert.match(yen.details.amountLabel,/JPY/)
  const dinar=await getPrice(stripe(price('subscription',{currency:'kwd',unit_amount:1234500})),'ember','subscription')
  assert.equal(dinar.details.amount,1234.5);assert.match(dinar.details.amountLabel,/KWD/)
}))

test('public route retrieves expanded actual prices and exposes only the customer pricing projection',()=>configured(async()=>{
  globalThis.pricingObjects={price_EmberMonthly:price(),price_EmberFull:price('annual',{metadata:{program:'ember',access_months:'9',internal_review:'private'}})}
  const response=await route.GET(request('ember'));assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/)
  const body=await response.json();assert.equal(body.program,'ember');assert.equal(body.subscription.available,true);assert.equal(body.annual.available,true);assert.equal(body.annual.coverageLabel,'Includes 9 months of program access.')
  assert.equal(globalThis.pricingRetrievals.length,2);assert.ok(globalThis.pricingRetrievals.every(call=>call.options.expand[0]==='product'))
  assert.doesNotMatch(JSON.stringify(body),/sk_test_|price_Ember|prod_Ember|private|internal_review|metadata|accessMonths|mode/)
  assert.deepEqual(JSON.parse(JSON.stringify(publicPriceDetails({available:true,amount:360,currency:'USD',mode:'subscription',accessMonths:1}))),{available:true,amount:360,currency:'USD'})
}))

test('missing configuration, unsupported programs and provider failures return safe errors without secret/provider payloads',()=>configured(async()=>{
  assert.equal((await route.GET(request('unsupported'))).status,400)
  delete process.env.STRIPE_SECRET_KEY;assert.equal((await route.GET(request('ember'))).status,503);assert.equal(globalThis.pricingSecretsSeen.length,0)
  process.env.STRIPE_SECRET_KEY='sk_test_mock_only'
  globalThis.pricingObjects={price_EmberMonthly:new Error('Provider secret sk_live_do_not_leak and raw customer payload'),price_EmberFull:new Error('Internal request ID req_private')}
  const failed=await route.GET(request('ember'));assert.equal(failed.status,503);assert.doesNotMatch(JSON.stringify(await failed.json()),/sk_live_|raw customer|req_private/)
  globalThis.pricingObjects.price_EmberMonthly=price()
  const partial=await route.GET(request('ember'));assert.equal(partial.status,200);const body=await partial.json();assert.equal(body.subscription.available,true);assert.equal(body.annual.available,false)
  delete process.env.EMBER_SUB_PRICE;delete process.env.EMBER_YEAR_PRICE
  assert.equal((await route.GET(request('ember'))).status,503)
  assert.equal(parseProgram(' EMBER '),'ember');assert.equal(parseBilling('annual'),'annual');assert.equal(parseBilling('unapproved'),null)
}))
