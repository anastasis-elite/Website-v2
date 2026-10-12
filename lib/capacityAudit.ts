export const CAPACITY_AUDIT_TIME = 'About 1–2 minutes'
export const CAPACITY_AUDIT_VERSION = 'capacity_snapshot_v1'
export const capacityQuestions = {
 energyLevel:[{value:'exhausted',label:'Exhausted',score:5},{value:'drained',label:'Drained',score:4},{value:'managing',label:'Managing',score:3},{value:'good',label:'Good',score:2},{value:'thriving',label:'Thriving',score:1}],
 overwhelmLevel:[{value:'constantly',label:'Constantly',score:5},{value:'most_days',label:'Most Days',score:4},{value:'sometimes',label:'Sometimes',score:3},{value:'rarely',label:'Rarely',score:2},{value:'almost_never',label:'Almost Never',score:1}],
 timeAvailable:[{value:'almost_none',label:'Almost None',score:5},{value:'15_minutes',label:'15 Minutes',score:4},{value:'30_minutes',label:'30 Minutes',score:3},{value:'1_hour',label:'1 Hour',score:2},{value:'more_than_1_hour',label:'More Than 1 Hour',score:1}],
 supportLevel:[{value:'alone',label:'Completely Alone',score:5},{value:'limited',label:'Limited Support',score:4},{value:'some',label:'Some Support',score:3},{value:'good',label:'Good Support',score:2},{value:'strong',label:'Strong Support',score:1}],
 currentSeason:[{value:'surviving',label:'Surviving',score:5},{value:'regaining_consistency',label:'Regaining Consistency',score:4},{value:'building_momentum',label:'Building Momentum',score:3},{value:'optimizing',label:'Optimizing',score:2},{value:'performing',label:'Performing Higher',score:1}],
}
const fields = {energyLevel:'energy_level',overwhelmLevel:'overwhelm_level',timeAvailable:'time_available',supportLevel:'support_level',currentSeason:'current_season'} as const
export function normalizeCapacityAudit(body: any) {
 if(!body || typeof body !== 'object' || Array.isArray(body))throw new Error('Enter your name, email, and five answers.')
 const fullName=typeof body.fullName==='string'?body.fullName.trim():''
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():''
 if(!fullName || fullName.length>160)throw new Error('Enter your name (up to 160 characters).')
 if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.')
 if(body.agreement!==true)throw new Error('Please agree to the Terms of Use and Health Disclaimer.')
 const answers:Record<string,string>={};let score=0
 for(const [key,field] of Object.entries(fields)){
  const option=capacityQuestions[key as keyof typeof capacityQuestions].find(option=>option.value===body[field])
  if(!option)throw new Error('Please answer every Capacity Audit question using the available choices.')
  answers[field]=option.value;score+=option.score
 }
 const recommendedProgram:'ember'|'ignite'|'phoenix'=score<=10?'ember':score<=17?'ignite':'phoenix'
 return {fullName,email,answers,score,recommendedProgram,emailConsent:body.email_consent===true}
}
