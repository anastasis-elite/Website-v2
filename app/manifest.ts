import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Anastasis | Woman-Centered Performance',
    short_name: 'Anastasis',
    description: 'Your personalized training, nutrition, cycle, and recovery system.',
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
