import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import './globals.css'
import CookieBanner from '../components/CookieBanner'
import AuthButton from '@/components/AuthButton'
import '@/lib/posthog'
import PwaRegistration from '@/components/PwaRegistration'
import LegalFooter from '@/components/LegalFooter'

export const metadata: Metadata = {
  title: 'Anastasis | Woman-Centered Performance',
  description:
    'A luxury, woman-centered training experience built around female physiology, nervous system safety, and sustainable performance.',
  applicationName: 'Anastasis',
  manifest: '/manifest.webmanifest',
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
  return (
    <html lang="en">
      <body>
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
