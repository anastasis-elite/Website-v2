import Image from 'next/image'
import type { PhotoComparison, PhotoSet, PhotoView } from '@/lib/assessment/photoComparison'

export function PhotoSetView({ set, view, label }: { set: PhotoSet | null; view: PhotoView; label: string }) {
  const url = set?.views[view]
  return <figure className="assessment-photo-view">
    {url ? <Image src={url} alt={`${label} · ${new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(set!.date))}`} width={360} height={480} />
      : <div className="assessment-photo-missing">{set ? `${label} unavailable in this set` : 'No photo set yet'}</div>}
    <figcaption>{label}</figcaption>
  </figure>
}

export default function ProgressPhotoComparison({ comparison }: { comparison: PhotoComparison }) {
  if (comparison.unavailable) return <p className="assessment-notice" role="status">Your comparison could not be loaded. Refresh to check your saved photo sets.</p>
  const sideLabel = comparison.side === 'left' ? 'Left side view' : 'Right side view'
  return <section className="assessment-section">
    {!comparison.first ? <p>Your first photo set will appear here. Add another set later to compare.</p> : null}
    {comparison.first && !comparison.latest ? <p>One set saved. Add another to see your latest beside your first.</p> : null}
    <div className="assessment-photo-comparison">{(['first', 'latest'] as const).map(key => {
      const set = comparison[key]
      return <section key={key}><header><h2>{key === 'first' ? 'First set' : 'Latest set'}</h2><p>{set ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(set.date)) : 'Not added yet'}</p></header>
        <PhotoSetView set={set} view="front" label="Front view" /><PhotoSetView set={set} view={comparison.side} label={sideLabel} />
      </section>
    })}</div>
  </section>
}
