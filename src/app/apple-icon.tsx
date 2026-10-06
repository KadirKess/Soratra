import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'
export const runtime = 'nodejs'

export default async function AppleIcon() {
  const font = await readFile(join(process.cwd(), 'src/app/fonts/cormorant-garamond-600.ttf'))

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAF6EF',
          border: '11px solid #1C1917',
          borderRadius: 45,
          color: '#1C1917',
          fontFamily: 'Cormorant',
          fontSize: 155,
          fontWeight: 600,
          lineHeight: 1,
          paddingBottom: 8,
        }}
      >
        S
      </div>
    ),
    { ...size, fonts: [{ name: 'Cormorant', data: font, weight: 600 }] },
  )
}
