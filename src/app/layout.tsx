import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from '@/components/providers'
import { Shell } from '@/components/layout/Shell'
import { siteConfig } from '@/lib/config'

const cormorant = localFont({
  src: [
    { path: './fonts/cormorant-garamond-300.ttf', weight: '300' },
    { path: './fonts/cormorant-garamond-400.ttf', weight: '400' },
    { path: './fonts/cormorant-garamond-500.ttf', weight: '500' },
    { path: './fonts/cormorant-garamond-600.ttf', weight: '600' },
  ],
  variable: '--font-cormorant',
})

// Reader notes only. Its own call so it can skip preloading: the files are
// large and most pages never show a note.
const cormorantItalic = localFont({
  src: [
    { path: './fonts/cormorant-garamond-400-italic.ttf', weight: '400', style: 'italic' },
    { path: './fonts/cormorant-garamond-500-italic.ttf', weight: '500', style: 'italic' },
  ],
  variable: '--font-cormorant-italic',
  preload: false,
  // The default fallback is a resized Arial, which flashes while the file loads.
  // Without it, .reader-note falls through to the roman Cormorant instead.
  adjustFontFallback: false,
})

const dmSans = localFont({
  src: [
    { path: './fonts/dm-sans-400.ttf', weight: '400' },
    { path: './fonts/dm-sans-500.ttf', weight: '500' },
    { path: './fonts/dm-sans-600.ttf', weight: '600' },
    { path: './fonts/dm-sans-700.ttf', weight: '700' },
  ],
  variable: '--font-dm-sans',
})

export function generateMetadata(): Metadata {
  return {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: 'Soratra',
    template: '%s · Soratra',
  },
  description: 'Your reading life, collected.',
  robots: { index: false, follow: false },
  }
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#FAF6EF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${cormorantItalic.variable} ${dmSans.variable}`}>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  )
}
