import type { StructuralFilter } from './types'

const signalMap:Record<string,{emphasis:string;avoid:string;preferred:string;cue:string}>={
  pelvic:{emphasis:'trunk and hip control',avoid:'unstable_loaded_hip',preferred:'supported_hip',cue:'Keep your ribs stacked.'},
  rib:{emphasis:'pressure and trunk control',avoid:'uncontrolled_extension',preferred:'stacked_strength',cue:'Breathe before moving.'},
  shoulder:{emphasis:'scapular control',avoid:'fixed_overhead',preferred:'scapular_freedom',cue:'Let your shoulder blades move naturally.'},
  knee:{emphasis:'knee tracking',avoid:'unstable_single_leg',preferred:'supported_knee_dominant',cue:'Keep your knees tracking over your toes.'},
  foot:{emphasis:'foot stability',avoid:'unstable_foot',preferred:'stable_stance',cue:'Build pressure through your whole foot.'},
  asymmetry:{emphasis:'balanced unilateral control',avoid:'high_speed_unilateral',preferred:'supported_unilateral',cue:'Stay balanced from heel to toe.'},
}

export function buildStructuralFilter(photoRecord:any,initialAssessment:any):StructuralFilter{
  const raw={...(photoRecord?.posture_flags||{}),...(initialAssessment?.data?.compensation_flags||{})}
  const keys=Object.entries(raw).filter(([key,value])=>!key.includes('uploaded')&&!key.includes('ready_for')&&(value===true||typeof value==='string')).map(([key])=>key.toLowerCase())
  const matched=Array.from(new Set(keys.flatMap((key)=>Object.keys(signalMap).filter((signal)=>key.includes(signal)))))
  const uploaded=photoRecord?.uploaded_at?new Date(photoRecord.uploaded_at).getTime():Date.now();const weeks=Math.max(0,(Date.now()-uploaded)/604800000)
  const initial=matched.length?Math.max(.78,.9-matched.length*.025):1
  const reviewedQuality=Number(raw.movement_quality_score||0);const ceiling=reviewedQuality>0?Math.min(1,Math.max(initial,reviewedQuality/100)):.92
  const modifier=matched.length?Math.min(ceiling,Math.round((initial+(ceiling-initial)*Math.min(1,weeks/24))*100)/100):1
  return {modifier,internalSignals:matched,movementEmphasis:matched.map((key)=>signalMap[key].emphasis),avoidTags:matched.map((key)=>signalMap[key].avoid),preferredTags:matched.map((key)=>signalMap[key].preferred),generatedAt:new Date().toISOString()}
}

export function structuralCues(filter:StructuralFilter){return filter.internalSignals.map((key)=>signalMap[key]?.cue).filter(Boolean)}
