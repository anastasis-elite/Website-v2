import type { MetadataRoute } from 'next'
import { BRAND_DESCRIPTION } from '@/lib/seo'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Anastasis | Health & Performance Concierge Platform for Women',
    short_name: 'Anastasis',
    description: BRAND_DESCRIPTION,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0b0908',
    theme_color: '#0b0908',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
