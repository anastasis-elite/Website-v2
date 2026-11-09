import type { StaticImageData } from 'next/image'

import checkIn320 from '@/public/images/card-artwork/check-in-320.webp'
import checkIn640 from '@/public/images/card-artwork/check-in-640.webp'
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
import recovery320 from '@/public/images/card-artwork/recovery-320.webp'
import recovery640 from '@/public/images/card-artwork/recovery-640.webp'
import mobility320 from '@/public/images/card-artwork/mobility-320.webp'
import mobility640 from '@/public/images/card-artwork/mobility-640.webp'

const artwork: Record<string, { small: StaticImageData; large: StaticImageData }> = {
  'check-in': { small: checkIn320, large: checkIn640 },
  'nutrition': { small: nutrition320, large: nutrition640 },
  'water': { small: water320, large: water640 },
  'training': { small: training320, large: training640 },
  'schedule': { small: schedule320, large: schedule640 },
  'yogic-practices': { small: yogicPractices320, large: yogicPractices640 },
  'meditation': { small: meditation320, large: meditation640 },
  'breathwork': { small: breathwork320, large: breathwork640 },
  'sauna': { small: sauna320, large: sauna640 },
  'warm-soak': { small: warmSoak320, large: warmSoak640 },
  'slow-walk': { small: slowWalk320, large: slowWalk640 },
  'yoga-nidra': { small: yogaNidra320, large: yogaNidra640 },
  'recovery': { small: recovery320, large: recovery640 },
  'mobility': { small: mobility320, large: mobility640 },
}

/** Decorative artwork. Today/Plan opt into intrinsic dimensions; other card geometry stays unchanged. */
export default function CardArtwork({ kind, className, sizes = '(max-width: 350px) 100vw, 50vw', naturalProportions = false }: { kind: string; className?: string; sizes?: string; naturalProportions?: boolean }) {
  const image = artwork[kind]
  return <img
    src={image?.large.src ?? `/illustrations/today-${kind}.svg`}
    srcSet={image ? `${image.small.src} 320w, ${image.large.src} 640w` : undefined}
    sizes={image ? sizes : undefined}
    width={naturalProportions && image ? image.large.width : 360}
    height={naturalProportions && image ? image.large.height : 180}
    style={naturalProportions ? { aspectRatio: image ? `${image.large.width} / ${image.large.height}` : '360 / 180' } : undefined}
    alt="" className={className} data-supplied-artwork={image ? true : undefined}
    loading="lazy" decoding="async"
  />
}
