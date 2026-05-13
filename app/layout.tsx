import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import CookieBanner from '../components/CookieBanner'
import AuthButton from '@/components/AuthButton'

export const metadata: Metadata = {
  title: 'Anastasis | Woman-Centered Performance',
  description:
    'A luxury, woman-centered training experience built around female physiology, nervous system safety, and sustainable performance.',
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
          <Link href="/">Anastasis Elite</Link>
          <AuthButton />
        </header>

        {children}

        <CookieBanner />
      </body>
    </html>
  )
}
