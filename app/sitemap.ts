import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo'

const publicRoutes = [
  '/',
  '/what-is-anastasis',
  '/about',
  '/why',
  '/program',
  '/program/ember',
  '/program/ignite',
  '/program/phoenix',
  '/audit',
  '/terms',
  '/privacy',
  '/health-disclaimer',
  '/ai-disclaimer',
  '/refund-policy',
  '/research-consent',
  '/conditions',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return publicRoutes.map((route) => ({
    url: absoluteUrl(route),
    lastModified: now,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route === '/what-is-anastasis' || route === '/program' ? 0.9 : 0.6,
  }))
}
