export function calculateSleepHours(bedtime:string,wakeTime:string){
  const parse=(value:string)=>{const [hours,minutes]=value.split(':').map(Number);return Number.isFinite(hours)&&Number.isFinite(minutes)?hours*60+minutes:null}
  const bed=parse(bedtime),wake=parse(wakeTime)
  if(bed===null||wake===null)return null
  let duration=wake-bed
  if(duration<=0)duration+=24*60
  return Math.round(duration/15)/4
}
