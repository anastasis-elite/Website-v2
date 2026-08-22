import Image from 'next/image'
import AssessmentPhotoUpload from '@/components/AssessmentPhotoUpload'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getTierCapabilities } from '@/lib/entitlements'

export default async function ProgressPhotosPage() {
  const {supabase,client}=await getDashboardContext()
  const capabilities=getTierCapabilities(client.program)
  const {data:records}=await supabase.from('assessment_photos').select('*').eq('client_id',client.client_id).order('uploaded_at',{ascending:false}).limit(12)
  const history=(await Promise.all((records||[]).flatMap((record:any)=>['front_photo_url','back_photo_url','left_photo_url','right_photo_url'].map((key)=>({path:record[key],date:record.uploaded_at,type:record.assessment_type}))).filter((item:any)=>item.path).map(async(item:any)=>{const {data}=await supabase.storage.from('assessment_photos').createSignedUrl(item.path,1800);return data?.signedUrl?{...item,url:data.signedUrl}:null}))).filter(Boolean) as Array<{url:string;date:string;type:string}>
  return (
    <main className="aos-photo-page">
      <div className="aos-photo-shell">
        <header className="aos-flow-hero"><p className="aos-eyebrow">Photos</p><h1>Track change without relying only on the scale.</h1><p>{capabilities.postureAssessment?'Upload progress photos for private comparison or posture photos when movement review is needed.':'Upload progress photos for private comparison and assessment history.'}</p></header>
        <AssessmentPhotoUpload postureAssessmentEnabled={capabilities.postureAssessment} />
        <section className="aos-photo-history"><div><p className="aos-eyebrow">History</p><h2>Your private gallery</h2></div>{history.length?<div className="aos-photo-gallery">{history.map((photo,index)=><figure key={`${photo.url}-${index}`}><Image src={photo.url} alt={`${photo.type||'Progress'} photo`} width={360} height={480}/><figcaption>{photo.type||'Progress'} · {new Date(photo.date).toLocaleDateString()}</figcaption></figure>)}</div>:<p>No photo history yet. Your first upload will appear here.</p>}</section>
      </div>
    </main>
  )
}
