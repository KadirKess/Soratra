import type { MetadataRoute } from 'next'

// The app is private (noindex), but a manifest still gives Soratra a
// real installable / home-screen identity. Use a rendered mark so devices do
// not substitute a different font for the letterform.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Soratra',
    short_name: 'Soratra',
    description: 'Your reading life, collected.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF6EF',
    theme_color: '#FAF6EF',
    icons: [
      { src: '/soratra-icon.png', type: 'image/png', sizes: '1024x1024', purpose: 'any' },
      { src: '/soratra-icon.png', type: 'image/png', sizes: '1024x1024', purpose: 'maskable' },
    ],
  }
}
