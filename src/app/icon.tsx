import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'
export const runtime = 'nodejs'

export default async function Icon() {
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
          border: '4px solid #1C1917',
          borderRadius: 16,
          color: '#1C1917',
          fontFamily: 'Cormorant',
          fontSize: 55,
          fontWeight: 600,
          lineHeight: 1,
          paddingBottom: 3,
        }}
      >
        S
      </div>
    ),
    { ...size, fonts: [{ name: 'Cormorant', data: font, weight: 600 }] },
  )
}
