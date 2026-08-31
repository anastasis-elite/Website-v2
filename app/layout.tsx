import type { Metadata, Viewport } from 'next'
import './globals.css'
import CookieBanner from '../components/CookieBanner'
import AuthButton from '@/components/AuthButton'
import '@/lib/posthog'
import PwaRegistration from '@/components/PwaRegistration'
import LegalFooter from '@/components/LegalFooter'
import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  BRAND_TITLE,
  LOGO_URL,
  OG_IMAGE_URL,
  SITE_URL,
  absoluteUrl,
} from '@/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: BRAND_TITLE,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: 'Anastasis',
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    title: BRAND_TITLE,
    description: BRAND_DESCRIPTION,
    url: '/',
    siteName: BRAND_NAME,
    images: [
      {
        url: OG_IMAGE_URL,
        width: 512,
        height: 512,
        alt: 'Anastasis logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: BRAND_TITLE,
    description: BRAND_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Anastasis',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0908',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': absoluteUrl('/#organization'),
        name: BRAND_NAME,
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: LOGO_URL,
        },
        description: BRAND_DESCRIPTION,
      },
      {
        '@type': 'WebSite',
        '@id': absoluteUrl('/#website'),
        name: BRAND_NAME,
        url: SITE_URL,
        publisher: {
          '@id': absoluteUrl('/#organization'),
        },
      },
      {
        '@type': 'WebApplication',
        '@id': absoluteUrl('/#application'),
        name: BRAND_NAME,
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Web',
        description: BRAND_DESCRIPTION,
        url: SITE_URL,
        provider: {
          '@id': absoluteUrl('/#organization'),
        },
      },
    ],
  }

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <header className="nav">
          <AuthButton />
        </header>

        {children}

        <LegalFooter />

        <CookieBanner />
        <PwaRegistration />
      </body>
    </html>
  )
}
