import nutrition320 from '@/public/images/card-artwork/nutrition-320.webp'
import nutrition640 from '@/public/images/card-artwork/nutrition-640.webp'
import water320 from '@/public/images/card-artwork/water-320.webp'
import water640 from '@/public/images/card-artwork/water-640.webp'
import training320 from '@/public/images/card-artwork/training-320.webp'
import training640 from '@/public/images/card-artwork/training-640.webp'
import schedule320 from '@/public/images/card-artwork/schedule-320.webp'
import schedule640 from '@/public/images/card-artwork/schedule-640.webp'
import yogicPractices320 from '@/public/images/card-artwork/yogic-practices-320.webp'
import yogicPractices640 from '@/public/images/card-artwork/yogic-practices-640.webp'
import meditation320 from '@/public/images/card-artwork/meditation-320.webp'
import meditation640 from '@/public/images/card-artwork/meditation-640.webp'
import breathwork320 from '@/public/images/card-artwork/breathwork-320.webp'
import breathwork640 from '@/public/images/card-artwork/breathwork-640.webp'
import sauna320 from '@/public/images/card-artwork/sauna-320.webp'
import sauna640 from '@/public/images/card-artwork/sauna-640.webp'
import warmSoak320 from '@/public/images/card-artwork/warm-soak-320.webp'
import warmSoak640 from '@/public/images/card-artwork/warm-soak-640.webp'
import slowWalk320 from '@/public/images/card-artwork/slow-walk-320.webp'
import slowWalk640 from '@/public/images/card-artwork/slow-walk-640.webp'
import yogaNidra320 from '@/public/images/card-artwork/yoga-nidra-320.webp'
import yogaNidra640 from '@/public/images/card-artwork/yoga-nidra-640.webp'
import mobility320 from '@/public/images/card-artwork/mobility-320.webp'
import mobility640 from '@/public/images/card-artwork/mobility-640.webp'

const artwork: Record<string, { small: string; large: string }> = {
  'nutrition': { small: nutrition320.src, large: nutrition640.src },
  'water': { small: water320.src, large: water640.src },
  'training': { small: training320.src, large: training640.src },
  'schedule': { small: schedule320.src, large: schedule640.src },
  'yogic-practices': { small: yogicPractices320.src, large: yogicPractices640.src },
  'meditation': { small: meditation320.src, large: meditation640.src },
  'breathwork': { small: breathwork320.src, large: breathwork640.src },
  'sauna': { small: sauna320.src, large: sauna640.src },
  'warm-soak': { small: warmSoak320.src, large: warmSoak640.src },
  'slow-walk': { small: slowWalk320.src, large: slowWalk640.src },
  'yoga-nidra': { small: yogaNidra320.src, large: yogaNidra640.src },
  'mobility': { small: mobility320.src, large: mobility640.src },
}

/** Decorative card artwork; keep the existing card geometry and accessible labels. */
export default function CardArtwork({ kind, className, sizes = '(max-width: 350px) 100vw, 50vw' }: { kind: string; className?: string; sizes?: string }) {
  const image = artwork[kind]
  return <img
    src={image?.large ?? `/illustrations/today-${kind}.svg`}
    srcSet={image ? `${image.small} 320w, ${image.large} 640w` : undefined}
    sizes={image ? sizes : undefined}
    width="360" height="180" alt="" className={className}
    loading="lazy" decoding="async"
  />
}
