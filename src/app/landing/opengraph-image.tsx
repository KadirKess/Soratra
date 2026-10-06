import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'nodejs'

export default async function OpenGraphImage() {
  const [displayFont, bodyFont] = await Promise.all([
    readFile(join(process.cwd(), 'src/app/fonts/cormorant-garamond-600.ttf')),
    readFile(join(process.cwd(), 'src/app/fonts/dm-sans-600.ttf')),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'stretch',
          background: '#FAF6EF',
          color: '#1C1917',
          display: 'flex',
          height: '100%',
          overflow: 'hidden',
          padding: '58px 64px',
          position: 'relative',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 4, width: 570 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#9A4210', fontFamily: 'DMSans', fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' }}>
              A home for your reading life
            </div>
            <div style={{ fontFamily: 'Cormorant', fontSize: 114, fontWeight: 600, letterSpacing: -4, lineHeight: 0.82, marginTop: 36 }}>
              Soratra
            </div>
            <div style={{ fontFamily: 'DMSans', fontSize: 28, fontWeight: 600, lineHeight: 1.25, marginTop: 30, width: 510 }}>
              Track books. See what friends are reading.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', height: 500, marginLeft: 24, position: 'relative', width: 478 }}>
          <div style={{ background: '#B8D0E0', border: '6px solid #1C1917', display: 'flex', height: 286, left: 98, padding: 28, position: 'absolute', top: 24, transform: 'rotate(-7deg)', width: 330 }}>
            <div style={{ borderBottom: '5px solid #1C1917', display: 'flex', fontFamily: 'DMSans', fontSize: 21, fontWeight: 600, height: 46, letterSpacing: 2, textTransform: 'uppercase', width: '100%' }}>
              Reading log
            </div>
          </div>
          <div style={{ background: '#EDD98A', border: '6px solid #1C1917', display: 'flex', flexDirection: 'column', height: 314, left: 42, padding: 30, position: 'absolute', top: 165, transform: 'rotate(5deg)', width: 356 }}>
            <div style={{ display: 'flex', fontFamily: 'Cormorant', fontSize: 50, fontWeight: 600, lineHeight: 1 }}>
              My Streak
            </div>
            <div style={{ background: '#1C1917', display: 'flex', height: 18, marginTop: 28, width: '100%' }} />
            <div style={{ background: '#E07A3A', display: 'flex', height: 18, marginTop: 12, width: '68%' }} />
          </div>
          <div style={{ alignItems: 'center', background: '#C8DDB8', border: '6px solid #1C1917', display: 'flex', height: 230, justifyContent: 'center', left: 230, position: 'absolute', top: 278, transform: 'rotate(-3deg)', width: 214 }}>
            <div style={{ border: '6px solid #1C1917', display: 'flex', height: 112, position: 'relative', width: 112 }}>
              <div style={{ background: '#F2C4AE', borderRight: '6px solid #1C1917', display: 'flex', height: '100%', width: '50%' }} />
              <div style={{ background: '#FAF6EF', display: 'flex', height: '100%', width: '50%' }} />
              <div style={{ background: '#E07A3A', display: 'flex', height: 26, left: 27, position: 'absolute', top: -20, width: 28 }} />
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Cormorant', data: displayFont, weight: 600 },
        { name: 'DMSans', data: bodyFont, weight: 600 },
      ],
    },
  )
}
