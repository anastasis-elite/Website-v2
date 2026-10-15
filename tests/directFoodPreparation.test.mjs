import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { POST } = await importTs('app/api/nutrition-log/route.ts', {
  'next/server': 'export const NextResponse={json:(body,init)=>Response.json(body,init)}',
  '@/lib/supabase/server': 'export const createClient=async()=>globalThis.directFoodDatabase',
  '@/lib/nutrition/calculateMicronutrientTargets': 'export const calculateMicronutrientTargets=()=>({iron_target_mg:18})',
  '@/lib/nutrition/targetService': 'export const nutritionLogAuditFields=()=>({})',
  '@/lib/timezone': 'export const getClientLocalDate=()=>"2026-10-14"',
})

test('opening the first food entry cannot overwrite a concurrent saved daily row', async () => {
  const client={client_id:'own-client',auth_user_id:'owner',birthdate:'1990-01-01'}
  const saved={id:'own-log',client_id:client.client_id,auth_user_id:'owner',log_date:'2026-10-14',calories:2100,water_consumed_oz:36,meals:['legacy saved meal'],completed:true}
  const snapshot=structuredClone(saved), options=[], scopes=[]
  globalThis.directFoodDatabase={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},from(table){let mutation;const filters=[],query={select(){return query},eq(key,value){filters.push([key,value]);return query},upsert(value,config){mutation=value;options.push(config);return query},single:async()=>{throw new Error('Create-only must tolerate a conflicting existing row')},maybeSingle:async()=>{if(table==='clients')return {data:client,error:null};if(mutation)return {data:null,error:null};scopes.push(filters);return {data:saved,error:null}}};return query}}
  const response=await POST(new Request('https://local.invalid/api/nutrition-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:client.client_id,calories:1800,protein:100,carbs:200,fats:60,water_oz:90,meals:[],completed:false,createOnly:true})}))
  assert.equal(response.status,200)
  assert.equal((await response.json()).nutritionLog.water_consumed_oz,36)
  assert.equal(options[0].ignoreDuplicates,true)
  assert.deepEqual(saved,snapshot)
  assert.deepEqual(scopes[0],[['client_id',client.client_id],['auth_user_id','owner'],['log_date','2026-10-14']])
})
